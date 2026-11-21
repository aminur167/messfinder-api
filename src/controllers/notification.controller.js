// The notifications of the logged in user (every role). Triggers and events create them.
const { query } = require('../config/db');
const AppError = require('../utils/app-error');
const check = require('../utils/validate');

// GET /api/notifications?unread=1&page=1
// Newest first. unread_count is the number for the bell icon.
async function list(req, res) {
    const page = check.integer(req.query.page, 'Page', { fallback: 1, max: 100000 });
    const limit = check.integer(req.query.limit, 'Limit', { fallback: 20, max: 100 });
    const onlyUnread = req.query.unread === '1' || req.query.unread === 'true';

    const where = onlyUnread ? 'user_id = ? AND is_read = 0' : 'user_id = ?';
    const [totalRows, rows, unread] = await Promise.all([
        query(`SELECT COUNT(*) AS total FROM notifications WHERE ${where}`, [req.user.id]),
        query(
            `SELECT notification_id, message, is_read, created_at
               FROM notifications
              WHERE ${where}
              ORDER BY created_at DESC, notification_id DESC
              LIMIT ? OFFSET ?`,
            [req.user.id, limit, (page - 1) * limit]
        ),
        query('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.id]),
    ]);

    const total = totalRows[0].total;
    res.json({ data: rows, page, limit, total, total_pages: Math.ceil(total / limit), unread_count: unread[0].n });
}

// PATCH /api/notifications/:id/read
async function markRead(req, res) {
    const id = check.integer(req.params.id, 'Notification id');
    const result = await query('UPDATE notifications SET is_read = 1 WHERE notification_id = ? AND user_id = ?', [id, req.user.id]);
    if (result.affectedRows === 0) throw new AppError(404, 'Notification not found');
    res.json({ notification_id: id, is_read: 1 });
}

// PATCH /api/notifications/read-all
async function markAllRead(req, res) {
    const result = await query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [req.user.id]);
    res.json({ marked: result.affectedRows });
}

module.exports = { list, markRead, markAllRead };
