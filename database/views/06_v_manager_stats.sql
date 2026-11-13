-- ====================================================================
-- v_manager_stats
-- The overview cards of the Manager dashboard, one row per mess.
-- Total outstanding counts everybody who still owes money, also ex-members.
-- ====================================================================
USE mess_finder;

CREATE OR REPLACE VIEW v_manager_stats AS
WITH seat_counts AS (
    SELECT r.mess_id,
           SUM(s.status <> 'inactive')  AS total_seats,
           SUM(s.status = 'available')  AS free_seats,
           SUM(s.status = 'booked')     AS booked_seats
    FROM rooms AS r
    JOIN seats AS s ON s.room_id = r.room_id
    WHERE r.is_active = 1
    GROUP BY r.mess_id
),
member_counts AS (
    SELECT mess_id,
           SUM(member_status = 'active')       AS active_members,
           SUM(outstanding > 0)               AS members_with_dues,
           SUM(GREATEST(outstanding, 0))      AS total_outstanding
    FROM v_member_dues
    GROUP BY mess_id
),
collected_this_month AS (
    SELECT r.mess_id, SUM(p.amount) AS collected
    FROM payments AS p
    JOIN mess_members AS m ON m.member_id = p.member_id
    JOIN seats AS s ON s.seat_id = m.seat_id
    JOIN rooms AS r ON r.room_id = s.room_id
    WHERE p.paid_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
      AND p.paid_at <  DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)
    GROUP BY r.mess_id
)
SELECT me.mess_id,
       me.manager_id,
       me.mess_name,
       COALESCE(sc.total_seats, 0)        AS total_seats,
       COALESCE(sc.free_seats, 0)         AS free_seats,
       COALESCE(sc.booked_seats, 0)       AS booked_seats,
       ROUND(100 * COALESCE(sc.booked_seats, 0) / NULLIF(sc.total_seats, 0), 1) AS occupancy_percent,
       COALESCE(mc.active_members, 0)     AS active_members,
       COALESCE(mc.members_with_dues, 0)  AS members_with_dues,
       COALESCE(mc.total_outstanding, 0)  AS total_outstanding,
       COALESCE(c.collected, 0)           AS collected_this_month
FROM messes AS me
LEFT JOIN seat_counts          AS sc ON sc.mess_id = me.mess_id
LEFT JOIN member_counts        AS mc ON mc.mess_id = me.mess_id
LEFT JOIN collected_this_month AS c  ON c.mess_id  = me.mess_id;
