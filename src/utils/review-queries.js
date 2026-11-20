// The reviews of a mess. The public Mess details page and the manager's Reviews page both use this.
const { query } = require('../config/db');

// Returns { data, page, limit, total, total_pages, summary }.
// "Current member" or "Ex-member" is worked out from the member rows.
async function listReviews(messId, page, limit) {
    const [totalRows, summary, rows] = await Promise.all([
        query('SELECT COUNT(*) AS total FROM reviews WHERE mess_id = ?', [messId]),
        query(
            `SELECT ROUND(AVG(rating), 2) AS overall,
                    ROUND(AVG(cleanliness_rating), 2) AS cleanliness,
                    ROUND(AVG(safety_rating), 2) AS safety,
                    ROUND(AVG(food_rating), 2) AS food,
                    COUNT(*) AS review_count
               FROM reviews WHERE mess_id = ?`, [messId]),
        query(
            `SELECT r.review_id, r.rating, r.cleanliness_rating, r.safety_rating, r.food_rating,
                    r.comment, r.manager_reply, r.replied_at, r.created_at,
                    u.full_name AS reviewer_name,
                    CASE WHEN EXISTS (SELECT 1
                                        FROM mess_members AS m
                                        JOIN seats AS s  ON s.seat_id  = m.seat_id
                                        JOIN rooms AS rm ON rm.room_id = s.room_id
                                       WHERE m.student_id = r.student_id
                                         AND rm.mess_id = r.mess_id
                                         AND m.status = 'active')
                         THEN 'Current member' ELSE 'Ex-member' END AS reviewer_type
               FROM reviews AS r
               JOIN users AS u ON u.user_id = r.student_id
              WHERE r.mess_id = ?
              ORDER BY r.created_at DESC, r.review_id DESC
              LIMIT ? OFFSET ?`,
            [messId, limit, (page - 1) * limit]),
    ]);

    const total = totalRows[0].total;
    return { data: rows, page, limit, total, total_pages: Math.ceil(total / limit), summary: summary[0] };
}

module.exports = { listReviews };
