// Complaints: a student or a manager reports a mess or a person. The admin handles them (next step).
const { query, pool } = require('../config/db');
const AppError = require('../utils/app-error');
const check = require('../utils/validate');

// POST /api/complaints
// { "subject": "...", "description": "...", "mess_id": 1, "against_user_id": 5 }
// At least one of mess_id and against_user_id is needed. A manager's complaint is about his own mess
// when no mess is given. A trigger tells every admin.
async function create(req, res) {
    const body = req.body || {};
    const subject = check.text(body.subject, 'Subject', { min: 3, max: 150 });
    const description = check.text(body.description, 'Description', { min: 5, max: 2000 });
    let messId = check.optionalInteger(body.mess_id, 'Mess');
    const againstUserId = check.optionalInteger(body.against_user_id, 'User');

    if (req.user.role === 'manager' && messId === null) {
        const own = await query('SELECT mess_id FROM messes WHERE manager_id = ?', [req.user.id]);
        if (own.length > 0) messId = own[0].mess_id;
    }
    if (messId === null && againstUserId === null) {
        throw new AppError(400, 'Choose a mess or a user to complain about');
    }
    if (againstUserId === req.user.id) {
        throw new AppError(400, 'You cannot complain about yourself');
    }

    const [result] = await pool.query(
        'INSERT INTO complaints (complainant_id, against_user_id, mess_id, subject, description) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, againstUserId, messId, subject, description]
    );
    const rows = await query('SELECT * FROM complaints WHERE complaint_id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
}

// GET /api/complaints/my
// The complaints of the logged in user, with the status and the note of the admin.
async function mine(req, res) {
    res.json(await query(
        `SELECT c.complaint_id, c.subject, c.description, c.status, c.admin_note, c.created_at, c.resolved_at,
                c.mess_id, me.mess_name, c.against_user_id, u.full_name AS against_name
           FROM complaints AS c
           LEFT JOIN messes AS me ON me.mess_id = c.mess_id
           LEFT JOIN users AS u ON u.user_id = c.against_user_id
          WHERE c.complainant_id = ?
          ORDER BY c.created_at DESC, c.complaint_id DESC`,
        [req.user.id]
    ));
}

module.exports = { create, mine };
