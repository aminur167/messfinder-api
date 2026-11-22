// The admin's dashboard and reports. These queries use a window function (RANK),
// a recursive CTE (the list of months) and the views of the database.
const { query } = require('../config/db');

// GET /api/admin/dashboard
async function dashboard(req, res) {
    const [users, messes, complaints, pendingManagers, pendingMesses] = await Promise.all([
        query(
            `SELECT COUNT(*) AS total, COALESCE(SUM(role = 'student'), 0) AS students,
                    COALESCE(SUM(role = 'manager'), 0) AS managers, COALESCE(SUM(is_active = 0), 0) AS blocked
               FROM users`),
        query(
            `SELECT COUNT(*) AS total, COALESCE(SUM(status = 'verified'), 0) AS verified,
                    COALESCE(SUM(status = 'pending'), 0) AS pending, COALESCE(SUM(status = 'suspended'), 0) AS suspended
               FROM messes`),
        query("SELECT COUNT(*) AS open_complaints FROM complaints WHERE status IN ('open', 'in_review')"),
        query(
            `SELECT u.user_id, u.full_name, u.created_at
               FROM manager_profiles AS mp JOIN users AS u ON u.user_id = mp.manager_id
              WHERE mp.is_verified = 0 AND u.is_active = 1
              ORDER BY u.created_at DESC LIMIT 5`),
        query("SELECT mess_id, mess_name, created_at FROM messes WHERE status = 'pending' ORDER BY created_at DESC LIMIT 5"),
    ]);

    res.json({
        users: users[0],
        messes: messes[0],
        open_complaints: complaints[0].open_complaints,
        pending_verifications: pendingManagers.length + pendingMesses.length,
        recent_pending: { managers: pendingManagers, messes: pendingMesses },
    });
}

// GET /api/admin/reports
async function reports(req, res) {
    const [areas, topRated, newMembers, money, overdue] = await Promise.all([
        // verified messes and free seats in every area
        query(
            `SELECT a.area_id, a.area_name,
                    COUNT(DISTINCT me.mess_id) AS verified_messes,
                    COALESCE(SUM(s.status = 'available'), 0) AS free_seats
               FROM areas AS a
               LEFT JOIN messes AS me ON me.area_id = a.area_id AND me.status = 'verified'
               LEFT JOIN rooms AS r   ON r.mess_id = me.mess_id AND r.is_active = 1
               LEFT JOIN seats AS s   ON s.room_id = r.room_id AND s.status <> 'inactive'
              GROUP BY a.area_id, a.area_name
              ORDER BY verified_messes DESC, free_seats DESC, a.area_name`),
        // the best rated messes: RANK() numbers them, equal ratings share a place
        query(
            `SELECT mess_id, mess_name, area_name, avg_rating, review_count, ranking
               FROM (SELECT mess_id, mess_name, area_name, avg_rating, review_count,
                            RANK() OVER (ORDER BY avg_rating DESC, review_count DESC) AS ranking
                       FROM v_mess_summary
                      WHERE status = 'verified' AND avg_rating IS NOT NULL) AS ranked
              WHERE ranking <= 5
              ORDER BY ranking, mess_name`),
        // new members per month for the last 12 months. The recursive CTE makes the 12 months itself,
        // so a month with no new member is still listed (with 0).
        query(
            `WITH RECURSIVE months AS (
                 SELECT CAST(DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 11 MONTH), '%Y-%m-01') AS DATE) AS month_start
                 UNION ALL
                 SELECT DATE_ADD(month_start, INTERVAL 1 MONTH) FROM months
                  WHERE month_start < CAST(DATE_FORMAT(CURDATE(), '%Y-%m-01') AS DATE)
             )
             SELECT DATE_FORMAT(mo.month_start, '%Y-%m') AS month, COUNT(m.member_id) AS new_members
               FROM months AS mo
               LEFT JOIN mess_members AS m
                      ON m.join_date >= mo.month_start AND m.join_date < DATE_ADD(mo.month_start, INTERVAL 1 MONTH)
              GROUP BY mo.month_start
              ORDER BY mo.month_start`),
        // the money side of the whole system, from the view of the dashboard
        query(
            `SELECT COALESCE(SUM(total_outstanding), 0) AS total_outstanding,
                    COALESCE(SUM(collected_this_month), 0) AS collected_this_month,
                    COALESCE(SUM(active_members), 0) AS active_members,
                    COALESCE(SUM(free_seats), 0) AS free_seats
               FROM v_manager_stats`),
        query('SELECT COUNT(*) AS overdue_dues FROM v_overdue_dues'),
    ]);

    res.json({
        areas,
        top_rated: topRated,
        new_members_per_month: newMembers,
        money: { ...money[0], overdue_dues: overdue[0].overdue_dues },
    });
}

module.exports = { dashboard, reports };
