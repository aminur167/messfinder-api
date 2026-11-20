// What a student sees about messes: the list with filters, the details page,
// the seats of each room and the reviews.
const { query } = require('../config/db');
const AppError = require('../utils/app-error');
const check = require('../utils/validate');
const { groupRoomsAndSeats } = require('../utils/room-seats');
const { listReviews } = require('../utils/review-queries');

// Ways to sort the list. The website sends a word, we pick the SQL from this list,
// so nothing the user types ever becomes part of the SQL text.
const SORTS = {
    newest: 'me.created_at DESC',
    rent_low: 'ms.min_rent IS NULL, ms.min_rent ASC',
    rent_high: 'ms.max_rent DESC',
    rating: 'ms.avg_rating IS NULL, ms.avg_rating DESC, ms.review_count DESC',
    nearest: 'distance_km ASC',
};

// "1" or "true" means yes
function isYes(value) {
    return value === '1' || value === 'true';
}

// Puts a backslash before % and _ so the word is searched as plain text
function escapeLike(value) {
    return value.replace(/[\\%_]/g, '\\$&');
}

// Finds a mess the viewer is allowed to see.
// Everybody sees verified messes. A manager also sees his own mess (even before verification)
// and the admin sees all. Anything else is "not found", so a hidden mess is not revealed.
async function loadVisibleMess(messId, user) {
    const rows = await query(
        `SELECT me.*, a.area_name, u.full_name AS manager_name
           FROM messes AS me
           JOIN areas AS a ON a.area_id = me.area_id
           JOIN users AS u ON u.user_id = me.manager_id
          WHERE me.mess_id = ?`,
        [messId]
    );
    const mess = rows[0];
    const canSee = mess && (
        mess.status === 'verified' ||
        (user && (user.role === 'admin' || user.id === mess.manager_id))
    );
    if (!canSee) throw new AppError(404, 'Mess not found');
    return mess;
}

// GET /api/messes   and   GET /api/messes/nearby?university_id=3&km=3
async function list(req, res) {
    const q = req.query;
    const page = check.integer(q.page, 'Page', { fallback: 1, max: 100000 });
    const limit = check.integer(q.limit, 'Limit', { fallback: 12, max: 50 });

    const where = ["ms.status = 'verified'"];
    const whereParams = [];

    // ---- filters ----
    if (q.area_id !== undefined) {
        where.push('ms.area_id = ?');
        whereParams.push(check.integer(q.area_id, 'Area'));
    }
    if (q.type !== undefined) {
        where.push('ms.mess_type = ?');
        whereParams.push(check.oneOf(q.type, 'Type', ['boys', 'girls']));
    }
    const minRent = check.optionalNumber(q.min_rent, 'Minimum rent');
    const maxRent = check.optionalNumber(q.max_rent, 'Maximum rent');
    if (minRent !== undefined) {
        where.push('ms.max_rent >= ?');
        whereParams.push(minRent);
    }
    if (maxRent !== undefined) {
        where.push('ms.min_rent <= ?');
        whereParams.push(maxRent);
    }
    const minRating = check.optionalNumber(q.min_rating, 'Minimum rating', { min: 1, max: 5 });
    if (minRating !== undefined) {
        where.push('ms.avg_rating >= ?');
        whereParams.push(minRating);
    }
    if (isYes(q.has_meal)) where.push('ms.has_meal = 1');
    if (isYes(q.utility_included)) where.push('ms.utility_included = 1');
    if (isYes(q.only_free)) where.push('ms.free_seats > 0');

    // the mess must have ALL the chosen facilities
    const facilityIds = check.idList(q.facility_ids, 'Facility');
    if (facilityIds.length > 0) {
        where.push(`(SELECT COUNT(DISTINCT mf.facility_id)
                       FROM mess_facilities AS mf
                      WHERE mf.mess_id = ms.mess_id AND mf.facility_id IN (?)) = ?`);
        whereParams.push(facilityIds, facilityIds.length);
    }

    // messes that list this university as a nearby university
    // (on the /nearby route university_id means something else, see below)
    if (q.university_id !== undefined && req.nearUniversityId === undefined) {
        where.push(`EXISTS (SELECT 1 FROM mess_universities AS mu
                             WHERE mu.mess_id = ms.mess_id AND mu.university_id = ?)`);
        whereParams.push(check.integer(q.university_id, 'University'));
    }

    // words in the name, the address or the description
    if (q.q !== undefined && String(q.q).trim() !== '') {
        const word = check.text(String(q.q), 'Search word', { max: 100 });
        const like = `%${escapeLike(word)}%`;
        where.push('(me.mess_name LIKE ? OR me.address LIKE ? OR MATCH(me.description) AGAINST (? IN NATURAL LANGUAGE MODE))');
        whereParams.push(like, like, word);
    }

    // ---- nearby: messes within X km of a university ----
    let nearJoin = '';
    const nearParams = [];
    let distanceSelect = 'NULL AS distance_km';
    const nearId = q.near_university_id !== undefined ? q.near_university_id : req.nearUniversityId;
    if (nearId !== undefined) {
        const km = check.optionalNumber(q.km, 'Distance', { min: 0.1, max: 100 }) ?? 3;
        const distance = 'fn_distance_km(un.latitude, un.longitude, ms.latitude, ms.longitude)';
        nearJoin = 'JOIN universities AS un ON un.university_id = ?';
        nearParams.push(check.integer(nearId, 'University'));
        distanceSelect = `${distance} AS distance_km`;
        where.push(`${distance} <= ?`);
        whereParams.push(km);
    }

    // ---- sorting ----
    const defaultSort = nearJoin ? 'nearest' : 'newest';
    const sortName = q.sort === undefined ? defaultSort : check.oneOf(q.sort, 'Sort', Object.keys(SORTS));
    if (sortName === 'nearest' && !nearJoin) {
        throw new AppError(400, 'Sort by nearest needs near_university_id');
    }

    const from = `FROM v_mess_summary AS ms
                  JOIN messes AS me ON me.mess_id = ms.mess_id
                  ${nearJoin}
                  WHERE ${where.join(' AND ')}`;

    const totalRows = await query(`SELECT COUNT(*) AS total ${from}`, [...nearParams, ...whereParams]);
    const total = totalRows[0].total;

    const rows = await query(
        `SELECT ms.mess_id, ms.mess_name, ms.mess_type, ms.address, ms.area_id, ms.area_name,
                ms.has_meal, ms.meal_cost_monthly, ms.utility_included, ms.advance_amount,
                ms.total_seats, ms.free_seats, ms.min_rent, ms.max_rent,
                ms.avg_rating, ms.review_count, me.established_year, ${distanceSelect}
         ${from}
         ORDER BY ${SORTS[sortName]}
         LIMIT ? OFFSET ?`,
        [...nearParams, ...whereParams, limit, (page - 1) * limit]
    );

    // add the facilities, and "is_interested" for a logged in student
    if (rows.length > 0) {
        const messIds = rows.map((row) => row.mess_id);

        const facilities = await query(
            `SELECT mf.mess_id, f.facility_id, f.facility_name
               FROM mess_facilities AS mf
               JOIN facilities AS f ON f.facility_id = mf.facility_id
              WHERE mf.mess_id IN (?)
              ORDER BY f.facility_name`,
            [messIds]
        );

        let interestedIds = new Set();
        if (req.user && req.user.role === 'student') {
            const interests = await query(
                'SELECT mess_id FROM interests WHERE student_id = ? AND mess_id IN (?)',
                [req.user.id, messIds]
            );
            interestedIds = new Set(interests.map((row) => row.mess_id));
        }

        for (const row of rows) {
            row.facilities = facilities.filter((f) => f.mess_id === row.mess_id)
                .map((f) => ({ facility_id: f.facility_id, facility_name: f.facility_name }));
            row.is_interested = interestedIds.has(row.mess_id);
        }
    }

    res.json({ data: rows, page, limit, total, total_pages: Math.ceil(total / limit) });
}

// GET /api/messes/nearby?university_id=3&km=3
// Same as the list, with the "near" filter switched on.
function nearby(req, res) {
    if (req.query.university_id === undefined) {
        throw new AppError(400, 'university_id is required');
    }
    req.nearUniversityId = req.query.university_id;
    return list(req, res);
}

// GET /api/messes/:id
// Everything for the details page. The phone numbers are shown only to a logged in user.
async function details(req, res) {
    const messId = check.integer(req.params.id, 'Mess id');
    const mess = await loadVisibleMess(messId, req.user);

    const [stats, facilities, universities, history, ratings] = await Promise.all([
        query(
            `SELECT total_seats, free_seats, min_rent, max_rent, avg_rating, review_count
               FROM v_mess_summary WHERE mess_id = ?`, [messId]),
        query(
            `SELECT f.facility_id, f.facility_name
               FROM mess_facilities AS mf
               JOIN facilities AS f ON f.facility_id = mf.facility_id
              WHERE mf.mess_id = ?
              ORDER BY f.facility_name`, [messId]),
        query(
            `SELECT un.university_id, un.name, un.short_name, mu.distance_km
               FROM mess_universities AS mu
               JOIN universities AS un ON un.university_id = mu.university_id
              WHERE mu.mess_id = ?
              ORDER BY mu.distance_km`, [messId]),
        query('SELECT established_year, total_members_ever, current_members FROM v_mess_history WHERE mess_id = ?', [messId]),
        query(
            `SELECT ROUND(AVG(rating), 2) AS overall,
                    ROUND(AVG(cleanliness_rating), 2) AS cleanliness,
                    ROUND(AVG(safety_rating), 2) AS safety,
                    ROUND(AVG(food_rating), 2) AS food,
                    COUNT(*) AS review_count
               FROM reviews WHERE mess_id = ?`, [messId]),
    ]);

    const viewer = {
        logged_in: Boolean(req.user),
        is_owner: Boolean(req.user && req.user.id === mess.manager_id),
        is_interested: false,
        is_member: false,
        has_reviewed: false,
        can_review: false,
        conversation_id: null,
    };

    // what a student can do on this page
    if (req.user && req.user.role === 'student') {
        const [interest, review, member, conversation] = await Promise.all([
            query('SELECT 1 FROM interests WHERE student_id = ? AND mess_id = ?', [req.user.id, messId]),
            query('SELECT 1 FROM reviews WHERE student_id = ? AND mess_id = ?', [req.user.id, messId]),
            query(
                `SELECT 1 FROM mess_members AS m
                   JOIN seats AS s ON s.seat_id = m.seat_id
                   JOIN rooms AS r ON r.room_id = s.room_id
                  WHERE m.student_id = ? AND r.mess_id = ? LIMIT 1`, [req.user.id, messId]),
            query('SELECT conversation_id FROM conversations WHERE mess_id = ? AND student_id = ?', [messId, req.user.id]),
        ]);
        viewer.is_interested = interest.length > 0;
        viewer.has_reviewed = review.length > 0;
        viewer.is_member = member.length > 0;
        viewer.can_review = viewer.is_member && !viewer.has_reviewed;
        viewer.conversation_id = conversation.length > 0 ? conversation[0].conversation_id : null;
    }

    const answer = {
        mess_id: mess.mess_id,
        mess_name: mess.mess_name,
        mess_type: mess.mess_type,
        status: mess.status,
        address: mess.address,
        area_id: mess.area_id,
        area_name: mess.area_name,
        description: mess.description,
        rules: mess.rules,
        established_year: mess.established_year,
        has_meal: mess.has_meal,
        meal_cost_monthly: mess.meal_cost_monthly,
        utility_included: mess.utility_included,
        advance_amount: mess.advance_amount,
        latitude: mess.latitude,
        longitude: mess.longitude,
        stats: stats[0],
        ratings: ratings[0],
        history: history[0],
        facilities,
        universities,
        viewer,
    };

    // contact details only for a logged in user
    if (req.user) {
        answer.contact_phone = mess.contact_phone;
        answer.contact_whatsapp = mess.contact_whatsapp;
        answer.manager_name = mess.manager_name;
    }

    res.json(answer);
}

// GET /api/messes/:id/history   (numbers only, no names)
async function history(req, res) {
    const messId = check.integer(req.params.id, 'Mess id');
    await loadVisibleMess(messId, req.user);
    const rows = await query(
        'SELECT established_year, total_members_ever, current_members FROM v_mess_history WHERE mess_id = ?',
        [messId]
    );
    res.json(rows[0]);
}

// GET /api/messes/:id/seats
// The rooms with their seats. Who lives in a seat is shown only to the manager of the mess and the admin.
async function seats(req, res) {
    const messId = check.integer(req.params.id, 'Mess id');
    const mess = await loadVisibleMess(messId, req.user);
    const canSeePeople = Boolean(req.user && (req.user.role === 'admin' || req.user.id === mess.manager_id));

    const rows = await query(
        `SELECT room_id, room_no, floor_no, has_attached_bath, has_balcony, room_is_active,
                seat_id, seat_label, monthly_rent, seat_status, member_id, member_name, member_phone, member_since
           FROM v_room_seat_status
          WHERE mess_id = ?
          ORDER BY floor_no, room_no, seat_label`,
        [messId]
    );

    // the public does not see switched off rooms and seats, nor who lives where
    res.json(groupRoomsAndSeats(rows, { showPeople: canSeePeople, showInactive: canSeePeople }));
}

// GET /api/messes/:id/reviews?page=1&limit=10
async function reviews(req, res) {
    const messId = check.integer(req.params.id, 'Mess id');
    await loadVisibleMess(messId, req.user);
    const page = check.integer(req.query.page, 'Page', { fallback: 1, max: 100000 });
    const limit = check.integer(req.query.limit, 'Limit', { fallback: 10, max: 50 });
    res.json(await listReviews(messId, page, limit));
}

module.exports = { list, nearby, details, history, seats, reviews };
