// The admin approves new managers and messes. A mess is not seen by the public until it is verified.
const { query } = require('../config/db');
const AppError = require('../utils/app-error');
const check = require('../utils/validate');

// GET /api/admin/pending?managers_page=1&messes_page=1&limit=12
// The managers and the messes that wait for the admin. Each of the two lists has its own pages.
async function pending(req, res) {
    const limit = check.integer(req.query.limit, 'Limit', { fallback: 12, max: 50 });
    const managersPage = check.integer(req.query.managers_page, 'Page', { fallback: 1, max: 100000 });
    const messesPage = check.integer(req.query.messes_page, 'Page', { fallback: 1, max: 100000 });

    const [managerTotal, messTotal, managers, messes] = await Promise.all([
        query('SELECT COUNT(*) AS total FROM manager_profiles AS mp JOIN users AS u ON u.user_id = mp.manager_id WHERE mp.is_verified = 0 AND u.is_active = 1'),
        query("SELECT COUNT(*) AS total FROM messes WHERE status = 'pending'"),
        query(
            `SELECT u.user_id, u.full_name, u.email, u.phone, mp.nid_no, mp.address, u.created_at,
                    me.mess_id, me.mess_name, me.status AS mess_status
               FROM manager_profiles AS mp
               JOIN users AS u ON u.user_id = mp.manager_id
               LEFT JOIN messes AS me ON me.manager_id = mp.manager_id
              WHERE mp.is_verified = 0 AND u.is_active = 1
              ORDER BY u.created_at
              LIMIT ? OFFSET ?`,
            [limit, (managersPage - 1) * limit]
        ),
        query(
            `SELECT me.mess_id, me.mess_name, me.mess_type, me.address, a.area_name, me.created_at,
                    me.manager_id, u.full_name AS manager_name, mp.is_verified AS manager_verified,
                    (SELECT COUNT(*) FROM rooms AS r JOIN seats AS s ON s.room_id = r.room_id
                      WHERE r.mess_id = me.mess_id) AS seat_count
               FROM messes AS me
               JOIN areas AS a ON a.area_id = me.area_id
               JOIN users AS u ON u.user_id = me.manager_id
               JOIN manager_profiles AS mp ON mp.manager_id = me.manager_id
              WHERE me.status = 'pending'
              ORDER BY me.created_at
              LIMIT ? OFFSET ?`,
            [limit, (messesPage - 1) * limit]
        ),
    ]);

    const wrap = (data, page, total) => ({ data, page, limit, total, total_pages: Math.ceil(total / limit) });
    res.json({
        managers: wrap(managers, managersPage, managerTotal[0].total),
        messes: wrap(messes, messesPage, messTotal[0].total),
    });
}

// PATCH /api/admin/managers/:id/verify
async function verifyManager(req, res) {
    const managerId = check.integer(req.params.id, 'Manager id');
    const rows = await query('SELECT is_verified FROM manager_profiles WHERE manager_id = ?', [managerId]);
    if (rows.length === 0) throw new AppError(404, 'Manager not found');
    if (rows[0].is_verified) throw new AppError(400, 'This manager is already verified');

    await query('UPDATE manager_profiles SET is_verified = 1 WHERE manager_id = ?', [managerId]);
    await query('INSERT INTO notifications (user_id, message) VALUES (?, ?)', [managerId, 'Your manager account was verified.']);
    res.json({ manager_id: managerId, is_verified: 1 });
}

// A mess changes its status. A trigger tells the manager ("Your mess X is now verified").
async function setMessStatus(messId, newStatus) {
    const rows = await query(
        `SELECT me.status, mp.is_verified
           FROM messes AS me
           JOIN manager_profiles AS mp ON mp.manager_id = me.manager_id
          WHERE me.mess_id = ?`,
        [messId]
    );
    if (rows.length === 0) throw new AppError(404, 'Mess not found');
    if (rows[0].status === newStatus) throw new AppError(400, `This mess is already ${newStatus}`);
    if (rows[0].status === 'closed') throw new AppError(400, 'A closed mess cannot be changed');
    if (newStatus === 'verified' && !rows[0].is_verified) {
        throw new AppError(400, 'Verify the manager first');
    }

    await query('UPDATE messes SET status = ? WHERE mess_id = ?', [newStatus, messId]);
    return { mess_id: messId, status: newStatus };
}

// PATCH /api/admin/messes/:id/verify   (also brings back a suspended mess)
async function verifyMess(req, res) {
    res.json(await setMessStatus(check.integer(req.params.id, 'Mess id'), 'verified'));
}

// PATCH /api/admin/messes/:id/suspend   (a pending mess that is refused, or a verified mess that breaks the rules)
async function suspendMess(req, res) {
    res.json(await setMessStatus(check.integer(req.params.id, 'Mess id'), 'suspended'));
}

module.exports = { pending, verifyManager, verifyMess, suspendMess };
