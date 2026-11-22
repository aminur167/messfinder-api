// The Users page of the admin: look for users, block and unblock them.
// A blocked user cannot log in and his old tokens stop working at once. Nothing is deleted.
const { query } = require('../config/db');
const AppError = require('../utils/app-error');
const check = require('../utils/validate');

// GET /api/admin/users?role=manager&status=blocked&q=rafi&page=1
async function list(req, res) {
    const q = req.query;
    const page = check.integer(q.page, 'Page', { fallback: 1, max: 100000 });
    const limit = check.integer(q.limit, 'Limit', { fallback: 20, max: 100 });

    const where = ['1 = 1'];
    const params = [];
    if (q.role !== undefined) {
        where.push('u.role = ?');
        params.push(check.oneOf(q.role, 'Role', ['student', 'manager', 'admin']));
    }
    if (q.status !== undefined) {
        where.push('u.is_active = ?');
        params.push(check.oneOf(q.status, 'Status', ['active', 'blocked']) === 'active' ? 1 : 0);
    }
    if (q.q !== undefined && String(q.q).trim() !== '') {
        const like = `%${String(q.q).trim().replace(/[\\%_]/g, '\\$&')}%`;
        where.push('(u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
        params.push(like, like, like);
    }

    const condition = where.join(' AND ');
    const [totalRows, rows] = await Promise.all([
        query(`SELECT COUNT(*) AS total FROM users AS u WHERE ${condition}`, params),
        query(
            `SELECT u.user_id, u.full_name, u.email, u.phone, u.role, u.is_active, u.created_at
               FROM users AS u
              WHERE ${condition}
              ORDER BY u.created_at DESC, u.user_id DESC
              LIMIT ? OFFSET ?`,
            [...params, limit, (page - 1) * limit]
        ),
    ]);

    const total = totalRows[0].total;
    res.json({ data: rows, page, limit, total, total_pages: Math.ceil(total / limit) });
}

// PATCH /api/admin/users/:id/block  and  /unblock
function setBlocked(isBlocked) {
    return async (req, res) => {
        const userId = check.integer(req.params.id, 'User id');
        const rows = await query('SELECT role, is_active FROM users WHERE user_id = ?', [userId]);
        if (rows.length === 0) throw new AppError(404, 'User not found');
        if (rows[0].role === 'admin') throw new AppError(400, 'An admin account cannot be blocked');
        if (userId === req.user.id) throw new AppError(400, 'You cannot block yourself');

        const alreadyBlocked = !rows[0].is_active;
        if (isBlocked && alreadyBlocked) throw new AppError(400, 'This user is already blocked');
        if (!isBlocked && !alreadyBlocked) throw new AppError(400, 'This user is not blocked');

        await query('UPDATE users SET is_active = ? WHERE user_id = ?', [isBlocked ? 0 : 1, userId]);
        res.json({ user_id: userId, is_active: isBlocked ? 0 : 1 });
    };
}

module.exports = { list, setBlocked };
