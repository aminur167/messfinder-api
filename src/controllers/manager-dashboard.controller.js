// The Dashboard page of the manager: the overview cards and a few short lists.
const { query } = require('../config/db');
const { getOwnMess } = require('../utils/find-records');

// GET /api/manager/dashboard
async function dashboard(req, res) {
    const mess = await getOwnMess(req.user.id);

    const [stats, topDues, pendingVisits, newInterests, recentInterests, unread] = await Promise.all([
        // the six cards, from the view v_manager_stats
        query(
            `SELECT total_seats, free_seats, booked_seats, occupancy_percent, active_members,
                    members_with_dues, total_outstanding, collected_this_month
               FROM v_manager_stats WHERE mess_id = ?`, [mess.mess_id]),
        // the five members who owe the most
        query(
            `SELECT member_id, full_name, room_no, seat_label, outstanding, current_month_status
               FROM v_member_dues
              WHERE mess_id = ? AND outstanding > 0
              ORDER BY outstanding DESC, full_name
              LIMIT 5`, [mess.mess_id]),
        query("SELECT COUNT(*) AS n FROM visit_requests WHERE mess_id = ? AND status = 'pending'", [mess.mess_id]),
        query('SELECT COUNT(*) AS n FROM interests WHERE mess_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)', [mess.mess_id]),
        query(
            `SELECT u.full_name, i.created_at AS interested_at
               FROM interests AS i
               JOIN users AS u ON u.user_id = i.student_id
              WHERE i.mess_id = ?
              ORDER BY i.created_at DESC
              LIMIT 3`, [mess.mess_id]),
        query('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.id]),
    ]);

    res.json({
        mess: { mess_id: mess.mess_id, mess_name: mess.mess_name, status: mess.status },
        stats: stats[0],
        top_dues: topDues,
        activity: {
            pending_visits: pendingVisits[0].n,
            new_interests_last_7_days: newInterests[0].n,
            recent_interests: recentInterests,
            unread_notifications: unread[0].n,
        },
    });
}

module.exports = { dashboard };
