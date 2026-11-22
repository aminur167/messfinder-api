// The admin handles the complaints: open -> in review -> resolved or dismissed, with a note.
const { query } = require('../config/db');
const AppError = require('../utils/app-error');
const check = require('../utils/validate');

const STATUSES = ['open', 'in_review', 'resolved', 'dismissed'];

// GET /api/admin/complaints?status=open&page=1   (unfinished complaints first)
async function list(req, res) {
    const q = req.query;
    const page = check.integer(q.page, 'Page', { fallback: 1, max: 100000 });
    const limit = check.integer(q.limit, 'Limit', { fallback: 20, max: 100 });

    const where = ['1 = 1'];
    const params = [];
    if (q.status !== undefined) {
        where.push('c.status = ?');
        params.push(check.oneOf(q.status, 'Status', STATUSES));
    }
    const condition = where.join(' AND ');

    const [totalRows, rows] = await Promise.all([
        query(`SELECT COUNT(*) AS total FROM complaints AS c WHERE ${condition}`, params),
        query(
            `SELECT c.complaint_id, c.subject, c.description, c.status, c.admin_note, c.created_at, c.resolved_at,
                    c.complainant_id, cu.full_name AS complainant_name, cu.role AS complainant_role,
                    c.against_user_id, au.full_name AS against_name,
                    c.mess_id, me.mess_name
               FROM complaints AS c
               JOIN users AS cu ON cu.user_id = c.complainant_id
               LEFT JOIN users AS au ON au.user_id = c.against_user_id
               LEFT JOIN messes AS me ON me.mess_id = c.mess_id
              WHERE ${condition}
              ORDER BY (c.status IN ('open', 'in_review')) DESC, c.created_at DESC, c.complaint_id DESC
              LIMIT ? OFFSET ?`,
            [...params, limit, (page - 1) * limit]
        ),
    ]);

    const total = totalRows[0].total;
    res.json({ data: rows, page, limit, total, total_pages: Math.ceil(total / limit) });
}

// PATCH /api/admin/complaints/:id   { "status": "resolved", "admin_note": "..." }
// A trigger tells the person who complained when the status changes.
async function update(req, res) {
    const complaintId = check.integer(req.params.id, 'Complaint id');
    const body = req.body || {};
    if (body.status === undefined && body.admin_note === undefined) {
        throw new AppError(400, 'Send a status or a note');
    }

    const rows = await query('SELECT status, admin_note FROM complaints WHERE complaint_id = ?', [complaintId]);
    if (rows.length === 0) throw new AppError(404, 'Complaint not found');

    const status = body.status === undefined ? rows[0].status : check.oneOf(body.status, 'Status', STATUSES);
    const note = body.admin_note === undefined ? rows[0].admin_note : check.optionalText(body.admin_note, 'Note', { max: 255 });

    // resolved_at is filled for a finished complaint and empty for an unfinished one (a CHECK rule needs it)
    await query(
        `UPDATE complaints
            SET status = ?, admin_note = ?,
                resolved_at = IF(? IN ('resolved', 'dismissed'), COALESCE(resolved_at, NOW()), NULL)
          WHERE complaint_id = ?`,
        [status, note, status, complaintId]
    );

    const updated = await query(
        'SELECT complaint_id, status, admin_note, resolved_at FROM complaints WHERE complaint_id = ?',
        [complaintId]
    );
    res.json(updated[0]);
}

module.exports = { list, update };
