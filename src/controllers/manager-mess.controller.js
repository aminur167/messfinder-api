// The manager sets up his mess: the mess itself, its rooms and its seats.
// Every function works only on the mess of the logged in manager.
const { query, pool, withTransaction } = require('../config/db');
const AppError = require('../utils/app-error');
const check = require('../utils/validate');
const { getOwnMess, getOwnRoom, getOwnSeat } = require('../utils/find-records');
const { groupRoomsAndSeats } = require('../utils/room-seats');

// ---------- the mess ----------

// Reads and checks the mess form. Create and update use the same form.
function readMessForm(body) {
    const form = body || {};

    const hasMeal = check.flag(form.has_meal, 'Has meal');
    const mealCost = check.optionalNumber(form.meal_cost_monthly, 'Meal cost');
    if (hasMeal && mealCost === undefined) {
        throw new AppError(400, 'Meal cost is required when the mess serves meals');
    }

    // phone numbers are saved with the country code: 8801712345678
    const contactPhone = '88' + check.phone(form.contact_phone);
    const contactWhatsapp = form.contact_whatsapp ? '88' + check.phone(form.contact_whatsapp) : null;

    const year = check.optionalNumber(form.established_year, 'Established year', { min: 1950, max: new Date().getFullYear() });

    // nearby universities: [{ university_id: 3, distance_km: 0.7 }]
    const universities = [];
    if (form.universities !== undefined) {
        if (!Array.isArray(form.universities) || form.universities.length > 30) {
            throw new AppError(400, 'Universities must be a list');
        }
        for (const item of form.universities) {
            universities.push({
                university_id: check.integer(item && item.university_id, 'University'),
                distance_km: check.number(item && item.distance_km, 'Distance', { min: 0, max: 100 }),
            });
        }
    }

    return {
        mess_name: check.text(form.mess_name, 'Mess name', { min: 2, max: 120 }),
        address: check.text(form.address, 'Address', { min: 5, max: 255 }),
        area_id: check.integer(form.area_id, 'Area'),
        description: check.optionalText(form.description, 'Description', { max: 5000 }),
        mess_type: check.oneOf(form.mess_type, 'Mess type', ['boys', 'girls']),
        rules: check.optionalText(form.rules, 'Rules', { max: 5000 }),
        established_year: year === undefined ? null : year,
        contact_phone: contactPhone,
        contact_whatsapp: contactWhatsapp,
        has_meal: hasMeal,
        meal_cost_monthly: hasMeal ? mealCost : null,
        utility_included: check.flag(form.utility_included, 'Utility included'),
        advance_amount: check.optionalNumber(form.advance_amount, 'Advance') ?? 0,
        latitude: check.number(form.latitude, 'Latitude', { min: -90, max: 90 }),
        longitude: check.number(form.longitude, 'Longitude', { min: -180, max: 180 }),
        facility_ids: check.integerArray(form.facility_ids, 'Facilities'),
        universities,
    };
}

// Saves the facilities and the nearby universities of a mess.
async function saveLinks(connection, messId, form) {
    if (form.facility_ids.length > 0) {
        await connection.query(
            'INSERT INTO mess_facilities (mess_id, facility_id) VALUES ?',
            [form.facility_ids.map((id) => [messId, id])]
        );
    }
    if (form.universities.length > 0) {
        await connection.query(
            'INSERT INTO mess_universities (mess_id, university_id, distance_km) VALUES ?',
            [form.universities.map((u) => [messId, u.university_id, u.distance_km])]
        );
    }
}

// The whole mess of the manager with its facilities and nearby universities.
async function loadOwnMess(managerId) {
    const mess = await getOwnMess(managerId);
    const [facilities, universities] = await Promise.all([
        query(
            `SELECT f.facility_id, f.facility_name
               FROM mess_facilities AS mf
               JOIN facilities AS f ON f.facility_id = mf.facility_id
              WHERE mf.mess_id = ? ORDER BY f.facility_name`, [mess.mess_id]),
        query(
            `SELECT un.university_id, un.short_name, un.name, mu.distance_km
               FROM mess_universities AS mu
               JOIN universities AS un ON un.university_id = mu.university_id
              WHERE mu.mess_id = ? ORDER BY mu.distance_km`, [mess.mess_id]),
    ]);
    return { ...mess, facilities, universities };
}

// POST /api/manager/mess
// A new mess waits for the admin to verify it (a trigger tells the admins).
async function createMess(req, res) {
    const form = readMessForm(req.body);

    await withTransaction(async (connection) => {
        const [result] = await connection.query(
            `INSERT INTO messes (manager_id, area_id, mess_name, address, description, mess_type, rules,
                                 established_year, contact_phone, contact_whatsapp, has_meal, meal_cost_monthly,
                                 utility_included, advance_amount, latitude, longitude)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, form.area_id, form.mess_name, form.address, form.description, form.mess_type, form.rules,
             form.established_year, form.contact_phone, form.contact_whatsapp, form.has_meal, form.meal_cost_monthly,
             form.utility_included, form.advance_amount, form.latitude, form.longitude]
        );
        await saveLinks(connection, result.insertId, form);
    });

    res.status(201).json(await loadOwnMess(req.user.id));
}

// GET /api/manager/mess
async function getMess(req, res) {
    res.json(await loadOwnMess(req.user.id));
}

// PUT /api/manager/mess
// Changes the details. The status (verified, suspended...) is not changed here.
async function updateMess(req, res) {
    const mess = await getOwnMess(req.user.id);
    const form = readMessForm(req.body);

    await withTransaction(async (connection) => {
        await connection.query(
            `UPDATE messes
                SET area_id = ?, mess_name = ?, address = ?, description = ?, mess_type = ?, rules = ?,
                    established_year = ?, contact_phone = ?, contact_whatsapp = ?, has_meal = ?,
                    meal_cost_monthly = ?, utility_included = ?, advance_amount = ?, latitude = ?, longitude = ?
              WHERE mess_id = ?`,
            [form.area_id, form.mess_name, form.address, form.description, form.mess_type, form.rules,
             form.established_year, form.contact_phone, form.contact_whatsapp, form.has_meal,
             form.meal_cost_monthly, form.utility_included, form.advance_amount, form.latitude, form.longitude,
             mess.mess_id]
        );
        // the link rows carry no history, so they are simply replaced
        await connection.query('DELETE FROM mess_facilities WHERE mess_id = ?', [mess.mess_id]);
        await connection.query('DELETE FROM mess_universities WHERE mess_id = ?', [mess.mess_id]);
        await saveLinks(connection, mess.mess_id, form);
    });

    res.json(await loadOwnMess(req.user.id));
}

// ---------- rooms ----------

function readRoomForm(body) {
    const form = body || {};
    const floor = check.optionalNumber(form.floor_no, 'Floor', { min: 0, max: 100 });
    return {
        room_no: check.text(form.room_no, 'Room number', { max: 10 }),
        floor_no: floor === undefined ? null : Math.trunc(floor),
        has_attached_bath: check.flag(form.has_attached_bath, 'Attached bath'),
        has_balcony: check.flag(form.has_balcony, 'Balcony'),
    };
}

async function loadRoom(roomId) {
    const rows = await query('SELECT * FROM rooms WHERE room_id = ?', [roomId]);
    return rows[0];
}

// POST /api/manager/rooms
async function createRoom(req, res) {
    const mess = await getOwnMess(req.user.id);
    const form = readRoomForm(req.body);
    const [result] = await pool.query(
        'INSERT INTO rooms (mess_id, room_no, floor_no, has_attached_bath, has_balcony) VALUES (?, ?, ?, ?, ?)',
        [mess.mess_id, form.room_no, form.floor_no, form.has_attached_bath, form.has_balcony]
    );
    res.status(201).json(await loadRoom(result.insertId));
}

// PATCH /api/manager/rooms/:id
async function updateRoom(req, res) {
    const room = await getOwnRoom(req.user.id, check.integer(req.params.id, 'Room id'));
    const form = readRoomForm(req.body);
    await query(
        'UPDATE rooms SET room_no = ?, floor_no = ?, has_attached_bath = ?, has_balcony = ? WHERE room_id = ?',
        [form.room_no, form.floor_no, form.has_attached_bath, form.has_balcony, room.room_id]
    );
    res.json(await loadRoom(room.room_id));
}

// PATCH /api/manager/rooms/:id/deactivate  and  /activate
// A room is never deleted (soft delete): it is only switched off.
function setRoomActive(isActive) {
    return async (req, res) => {
        const room = await getOwnRoom(req.user.id, check.integer(req.params.id, 'Room id'));

        if (!isActive) {
            const people = await query(
                `SELECT COUNT(*) AS n
                   FROM mess_members AS m
                   JOIN seats AS s ON s.seat_id = m.seat_id
                  WHERE s.room_id = ? AND m.status = 'active'`,
                [room.room_id]
            );
            if (people[0].n > 0) {
                throw new AppError(409, 'This room still has members. Mark them as left first');
            }
        }

        await query('UPDATE rooms SET is_active = ? WHERE room_id = ?', [isActive ? 1 : 0, room.room_id]);
        res.json(await loadRoom(room.room_id));
    };
}

// ---------- seats ----------

async function loadSeat(seatId) {
    const rows = await query('SELECT * FROM seats WHERE seat_id = ?', [seatId]);
    return rows[0];
}

// POST /api/manager/rooms/:id/seats
async function createSeat(req, res) {
    const room = await getOwnRoom(req.user.id, check.integer(req.params.id, 'Room id'));
    const body = req.body || {};
    const label = check.text(body.seat_label, 'Seat label', { max: 10 });
    const rent = check.number(body.monthly_rent, 'Monthly rent', { min: 1, max: 1000000 });

    const [result] = await pool.query(
        'INSERT INTO seats (room_id, seat_label, monthly_rent) VALUES (?, ?, ?)',
        [room.room_id, label, rent]
    );
    res.status(201).json(await loadSeat(result.insertId));
}

// PATCH /api/manager/seats/:id/rent
// A trigger saves the old and the new rent in seat_rent_log.
// Members who already live here keep the rent they joined with.
async function updateSeatRent(req, res) {
    const seat = await getOwnSeat(req.user.id, check.integer(req.params.id, 'Seat id'));
    const rent = check.number((req.body || {}).monthly_rent, 'Monthly rent', { min: 1, max: 1000000 });
    await query('UPDATE seats SET monthly_rent = ? WHERE seat_id = ?', [rent, seat.seat_id]);
    res.json(await loadSeat(seat.seat_id));
}

// PATCH /api/manager/seats/:id/deactivate  and  /activate
function setSeatActive(isActive) {
    return async (req, res) => {
        const seat = await getOwnSeat(req.user.id, check.integer(req.params.id, 'Seat id'));

        if (isActive && seat.status !== 'inactive') {
            throw new AppError(400, 'This seat is not switched off');
        }
        if (!isActive && seat.status === 'booked') {
            throw new AppError(409, 'This seat has a member. Mark the member as left first');
        }
        if (!isActive && seat.status === 'inactive') {
            throw new AppError(400, 'This seat is already switched off');
        }

        await query('UPDATE seats SET status = ? WHERE seat_id = ?', [isActive ? 'available' : 'inactive', seat.seat_id]);
        res.json(await loadSeat(seat.seat_id));
    };
}

// GET /api/manager/rooms-seats
// The Room-wise seats page: every room with its seats and who lives in them.
async function roomsAndSeats(req, res) {
    const mess = await getOwnMess(req.user.id);
    const rows = await query(
        `SELECT room_id, room_no, floor_no, has_attached_bath, has_balcony, room_is_active,
                seat_id, seat_label, monthly_rent, seat_status, member_id, member_name, member_phone, member_since
           FROM v_room_seat_status
          WHERE mess_id = ?
          ORDER BY floor_no, room_no, seat_label`,
        [mess.mess_id]
    );
    res.json(groupRoomsAndSeats(rows, { showPeople: true, showInactive: true }));
}

module.exports = {
    createMess, getMess, updateMess,
    createRoom, updateRoom, setRoomActive,
    createSeat, updateSeatRent, setSeatActive,
    roomsAndSeats,
};
