// The newsfeed and the "seat wanted" posts of students.
const { query, pool } = require('../config/db');
const AppError = require('../utils/app-error');
const check = require('../utils/validate');

// A student can have only this many open "seat wanted" posts at the same time.
const MAX_OPEN_WANTED_POSTS = 5;

// Adds to every vacancy post its seats and the numbers of its mess,
// and to every seat wanted post the university of the student.
// "viewer" tells the page what the logged in user can do with the post.
async function addDetails(rows, user) {
    const vacancyIds = rows.filter((row) => row.post_type === 'vacancy').map((row) => row.post_id);
    const wantedIds = rows.filter((row) => row.post_type === 'seat_wanted').map((row) => row.post_id);
    const messIds = [...new Set(rows.filter((row) => row.mess_id).map((row) => row.mess_id))];

    const seats = vacancyIds.length === 0 ? [] : await query(
        `SELECT ps.post_id, s.seat_id, r.room_no, s.seat_label, s.monthly_rent, s.status
           FROM post_seats AS ps
           JOIN seats AS s ON s.seat_id = ps.seat_id
           JOIN rooms AS r ON r.room_id = s.room_id
          WHERE ps.post_id IN (?)
          ORDER BY r.room_no, s.seat_label`,
        [vacancyIds]
    );

    const messes = messIds.length === 0 ? [] : await query(
        'SELECT mess_id, avg_rating, review_count, free_seats FROM v_mess_summary WHERE mess_id IN (?)',
        [messIds]
    );

    const wanted = wantedIds.length === 0 ? [] : await query(
        `SELECT wp.wanted_id, wp.university_id, pu.short_name AS preferred_university, au.short_name AS author_university
           FROM seat_wanted_posts AS wp
           JOIN student_profiles AS sp ON sp.student_id = wp.student_id
           JOIN universities AS au ON au.university_id = sp.university_id
           LEFT JOIN universities AS pu ON pu.university_id = wp.university_id
          WHERE wp.wanted_id IN (?)`,
        [wantedIds]
    );

    let interestedMessIds = new Set();
    if (user && user.role === 'student' && messIds.length > 0) {
        const interests = await query(
            'SELECT mess_id FROM interests WHERE student_id = ? AND mess_id IN (?)',
            [user.id, messIds]
        );
        interestedMessIds = new Set(interests.map((row) => row.mess_id));
    }

    for (const row of rows) {
        row.viewer = { is_mine: Boolean(user && user.id === row.author_user_id) };

        if (row.post_type === 'vacancy') {
            row.seats = seats.filter((seat) => seat.post_id === row.post_id)
                .map(({ post_id, ...seat }) => seat);
            const mess = messes.find((m) => m.mess_id === row.mess_id);
            row.mess = mess ? { avg_rating: mess.avg_rating, review_count: mess.review_count, free_seats: mess.free_seats } : null;
            row.viewer.is_interested = interestedMessIds.has(row.mess_id);
        } else {
            const extra = wanted.find((w) => w.wanted_id === row.post_id);
            row.university_id = extra.university_id;
            row.preferred_university = extra.preferred_university;
            row.author_university = extra.author_university;
        }
    }
    return rows;
}

// GET /api/newsfeed
// Vacancy posts and seat wanted posts together, newest first.
// Filters: type=vacancy|seat_wanted, area_id, mess_type=boys|girls, status=open (hides expired posts)
async function feed(req, res) {
    const q = req.query;
    const page = check.integer(q.page, 'Page', { fallback: 1, max: 100000 });
    const limit = check.integer(q.limit, 'Limit', { fallback: 10, max: 30 });

    // closed and removed posts are not shown; expired posts are shown with their label
    const statuses = q.status === undefined ? ['open', 'expired'] : [check.oneOf(q.status, 'Status', ['open'])];
    const where = ['status IN (?)'];
    const params = [statuses];

    if (q.type !== undefined) {
        where.push('post_type = ?');
        params.push(check.oneOf(q.type, 'Type', ['vacancy', 'seat_wanted']));
    }
    if (q.area_id !== undefined) {
        where.push('area_id = ?');
        params.push(check.integer(q.area_id, 'Area'));
    }
    if (q.mess_type !== undefined) {
        where.push('mess_type = ?');
        params.push(check.oneOf(q.mess_type, 'Mess type', ['boys', 'girls']));
    }

    const condition = where.join(' AND ');
    const totalRows = await query(`SELECT COUNT(*) AS total FROM v_newsfeed WHERE ${condition}`, params);
    const rows = await query(
        `SELECT * FROM v_newsfeed WHERE ${condition}
          ORDER BY created_at DESC, post_id DESC
          LIMIT ? OFFSET ?`,
        [...params, limit, (page - 1) * limit]
    );

    const total = totalRows[0].total;
    res.json({ data: await addDetails(rows, req.user), page, limit, total, total_pages: Math.ceil(total / limit) });
}

// ---------- seat wanted posts (students) ----------

async function loadWantedPost(wantedId) {
    const rows = await query('SELECT * FROM seat_wanted_posts WHERE wanted_id = ?', [wantedId]);
    return rows[0];
}

// POST /api/seat-wanted
async function createSeatWanted(req, res) {
    const body = req.body || {};

    const budgetMin = check.optionalNumber(body.budget_min, 'Minimum budget', { max: 1000000 });
    const budgetMax = check.optionalNumber(body.budget_max, 'Maximum budget', { max: 1000000 });
    if (budgetMin !== undefined && budgetMax !== undefined && budgetMin > budgetMax) {
        throw new AppError(400, 'Minimum budget cannot be more than the maximum budget');
    }

    const neededFrom = check.date(body.needed_from, 'Needed from');
    const today = (await query('SELECT CURDATE() AS today'))[0].today;
    if (neededFrom < today) {
        throw new AppError(400, 'Needed from cannot be a day in the past');
    }

    const open = await query(
        "SELECT COUNT(*) AS n FROM seat_wanted_posts WHERE student_id = ? AND status = 'open'",
        [req.user.id]
    );
    if (open[0].n >= MAX_OPEN_WANTED_POSTS) {
        throw new AppError(400, `You can have at most ${MAX_OPEN_WANTED_POSTS} open posts. Close one first`);
    }

    const [result] = await pool.query(
        `INSERT INTO seat_wanted_posts
                (student_id, title, description, area_id, university_id, budget_min, budget_max, mess_type, needed_from)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            req.user.id,
            check.text(body.title, 'Title', { min: 3, max: 150 }),
            check.optionalText(body.description, 'Description', { max: 2000 }),
            body.area_id === undefined || body.area_id === null ? null : check.integer(body.area_id, 'Area'),
            body.university_id === undefined || body.university_id === null ? null : check.integer(body.university_id, 'University'),
            budgetMin === undefined ? null : budgetMin,
            budgetMax === undefined ? null : budgetMax,
            check.oneOf(body.mess_type, 'Mess type', ['boys', 'girls']),
            neededFrom,
        ]
    );
    res.status(201).json(await loadWantedPost(result.insertId));
}

// GET /api/seat-wanted/my
async function mySeatWanted(req, res) {
    res.json(await query(
        `SELECT wp.*, (SELECT COUNT(*) FROM post_comments AS pc
                        WHERE pc.wanted_post_id = wp.wanted_id AND pc.is_deleted = 0) AS comment_count
           FROM seat_wanted_posts AS wp
          WHERE wp.student_id = ? AND wp.status <> 'removed'
          ORDER BY wp.created_at DESC`,
        [req.user.id]
    ));
}

// PATCH /api/seat-wanted/:id/close
async function closeSeatWanted(req, res) {
    const post = await loadWantedPost(check.integer(req.params.id, 'Post id'));
    if (!post || post.student_id !== req.user.id || post.status === 'removed') {
        throw new AppError(404, 'Post not found');
    }
    if (post.status !== 'open') {
        throw new AppError(400, 'This post is not open');
    }
    await query("UPDATE seat_wanted_posts SET status = 'closed' WHERE wanted_id = ?", [post.wanted_id]);
    res.json(await loadWantedPost(post.wanted_id));
}

module.exports = { feed, createSeatWanted, mySeatWanted, closeSeatWanted, addDetails };
