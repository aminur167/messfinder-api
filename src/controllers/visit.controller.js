// Visit requests: a student asks to see a mess, the manager answers.
const { query, pool } = require('../config/db');
const AppError = require('../utils/app-error');
const check = require('../utils/validate');
const { getOwnMess } = require('../utils/find-records');

// ---------- student ----------

// POST /api/visits   { "mess_id": 1, "visit_time": "2026-12-01 18:30", "student_note": "..." }
// Triggers check that the mess is verified and the time is in the future, and tell the manager.
async function create(req, res) {
    const body = req.body || {};
    const [result] = await pool.query(
        'INSERT INTO visit_requests (student_id, mess_id, visit_time, student_note) VALUES (?, ?, ?, ?)',
        [
            req.user.id,
            check.integer(body.mess_id, 'Mess'),
            check.dateTime(body.visit_time, 'Visit time'),
            check.optionalText(body.student_note, 'Note', { max: 255 }),
        ]
    );
    const rows = await query('SELECT * FROM visit_requests WHERE visit_id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
}

// GET /api/visits/my
async function mine(req, res) {
    res.json(await query(
        `SELECT v.visit_id, v.mess_id, me.mess_name, a.area_name, v.visit_time, v.status, v.student_note, v.created_at,
                (v.status IN ('pending', 'confirmed') AND v.visit_time > NOW()) AS can_cancel
           FROM visit_requests AS v
           JOIN messes AS me ON me.mess_id = v.mess_id
           JOIN areas AS a ON a.area_id = me.area_id
          WHERE v.student_id = ?
          ORDER BY v.visit_time DESC`,
        [req.user.id]
    ));
}

// PATCH /api/visits/:id/cancel
async function cancel(req, res) {
    const visitId = check.integer(req.params.id, 'Visit id');
    const rows = await query('SELECT status FROM visit_requests WHERE visit_id = ? AND student_id = ?', [visitId, req.user.id]);
    if (rows.length === 0) throw new AppError(404, 'Visit request not found');
    if (!['pending', 'confirmed'].includes(rows[0].status)) {
        throw new AppError(400, 'This visit request can no longer be cancelled');
    }
    await query("UPDATE visit_requests SET status = 'cancelled' WHERE visit_id = ?", [visitId]);
    res.json({ visit_id: visitId, status: 'cancelled' });
}

// ---------- manager ----------

// GET /api/manager/visits?status=pending&page=1
// A page of the requests (pending first). "counts" has the number of requests of every status,
// for the filter on the page.
async function forManager(req, res) {
    const mess = await getOwnMess(req.user.id);
    const page = check.integer(req.query.page, 'Page', { fallback: 1, max: 100000 });
    const limit = check.integer(req.query.limit, 'Limit', { fallback: 20, max: 100 });
    const where = ['v.mess_id = ?'];
    const params = [mess.mess_id];
    if (req.query.status !== undefined) {
        where.push('v.status = ?');
        params.push(check.oneOf(req.query.status, 'Status', ['pending', 'confirmed', 'rejected', 'cancelled', 'completed']));
    }

    const condition = where.join(' AND ');
    const [totalRows, rows, statusRows] = await Promise.all([
        query(`SELECT COUNT(*) AS total FROM visit_requests AS v WHERE ${condition}`, params),
        query(
            `SELECT v.visit_id, v.student_id, u.full_name, u.phone, un.short_name AS university,
                    v.visit_time, v.status, v.student_note, v.created_at
               FROM visit_requests AS v
               JOIN users AS u ON u.user_id = v.student_id
               JOIN student_profiles AS sp ON sp.student_id = v.student_id
               JOIN universities AS un ON un.university_id = sp.university_id
              WHERE ${condition}
              ORDER BY (v.status = 'pending') DESC, v.visit_time DESC, v.visit_id DESC
              LIMIT ? OFFSET ?`,
            [...params, limit, (page - 1) * limit]
        ),
        query('SELECT status, COUNT(*) AS n FROM visit_requests WHERE mess_id = ? GROUP BY status', [mess.mess_id]),
    ]);

    const counts = { all: 0, pending: 0, confirmed: 0, rejected: 0, cancelled: 0, completed: 0 };
    for (const row of statusRows) {
        counts[row.status] = row.n;
        counts.all += row.n;
    }
    const total = totalRows[0].total;
    res.json({ data: rows, page, limit, total, total_pages: Math.ceil(total / limit), counts });
}

// PATCH /api/manager/visits/:id/confirm | reject | complete
// confirm and reject answer a pending request (a trigger tells the student); complete is for a visit that happened.
function answer(action) {
    const rules = {
        confirm:  { from: 'pending',   to: 'confirmed' },
        reject:   { from: 'pending',   to: 'rejected' },
        complete: { from: 'confirmed', to: 'completed' },
    };
    const { from, to } = rules[action];

    return async (req, res) => {
        const mess = await getOwnMess(req.user.id);
        const visitId = check.integer(req.params.id, 'Visit id');

        const rows = await query('SELECT status FROM visit_requests WHERE visit_id = ? AND mess_id = ?', [visitId, mess.mess_id]);
        if (rows.length === 0) throw new AppError(404, 'Visit request not found');
        if (rows[0].status !== from) {
            throw new AppError(400, `Only a ${from} visit request can be ${to}`);
        }
        await query('UPDATE visit_requests SET status = ? WHERE visit_id = ?', [to, visitId]);
        res.json({ visit_id: visitId, status: to });
    };
}

module.exports = { create, mine, cancel, forManager, answer };
