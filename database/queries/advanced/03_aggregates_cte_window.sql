-- ====================================================================
-- Aggregates, CTEs and window functions
-- ====================================================================
USE mess_finder;


-- 1. GROUP BY with HAVING.
--    Areas that have more than one verified mess are shown (HAVING filters groups,
--    WHERE filters rows before grouping). With the demo data this can be empty,
--    change "> 1" to ">= 1" to see the result.
SELECT a.area_name, COUNT(*) AS verified_messes
FROM messes AS me
JOIN areas AS a ON a.area_id = me.area_id
WHERE me.status = 'verified'
GROUP BY a.area_id, a.area_name
HAVING COUNT(*) > 1;


-- 2. WITH ROLLUP: counts per mess and seat status, with totals added.
SELECT me.mess_name, s.status, COUNT(*) AS seats
FROM messes AS me
JOIN rooms AS r ON r.mess_id = me.mess_id
JOIN seats AS s ON s.room_id = r.room_id
GROUP BY me.mess_name, s.status WITH ROLLUP;


-- 3. GROUP_CONCAT: all facilities of each mess in one cell.
SELECT me.mess_name,
       GROUP_CONCAT(f.facility_name ORDER BY f.facility_name SEPARATOR ', ') AS facilities
FROM messes AS me
JOIN mess_facilities AS mf ON mf.mess_id = me.mess_id
JOIN facilities AS f ON f.facility_id = mf.facility_id
GROUP BY me.mess_id, me.mess_name;


-- 4. CTE (WITH): the dashboard numbers of Rahman Boys Mess, step by step.
--    A CTE is a named subquery, so a long query reads from top to bottom.
WITH seat_numbers AS (
    SELECT COUNT(*) AS total_seats,
           SUM(s.status = 'booked') AS booked_seats
    FROM rooms AS r
    JOIN seats AS s ON s.room_id = r.room_id
    WHERE r.mess_id = 1 AND s.status <> 'inactive'
),
money AS (
    SELECT SUM(outstanding) AS owed
    FROM v_member_dues
    WHERE mess_id = 1 AND outstanding > 0
)
SELECT sn.total_seats,
       sn.booked_seats,
       ROUND(100 * sn.booked_seats / sn.total_seats, 1) AS occupancy_percent,
       money.owed
FROM seat_numbers AS sn
CROSS JOIN money;


-- 5. Recursive CTE: a list of months made by the query itself (no table needed),
--    joined with payments to see how much money came in every month.
WITH RECURSIVE months AS (
    SELECT DATE('2026-01-01') AS month_start
    UNION ALL
    SELECT DATE_ADD(month_start, INTERVAL 1 MONTH)
    FROM months
    WHERE month_start < '2026-11-01'
)
SELECT DATE_FORMAT(mo.month_start, '%b %Y') AS month,
       COALESCE(SUM(p.amount), 0)           AS collected
FROM months AS mo
LEFT JOIN payments AS p
       ON p.paid_at >= mo.month_start
      AND p.paid_at <  DATE_ADD(mo.month_start, INTERVAL 1 MONTH)
GROUP BY mo.month_start
ORDER BY mo.month_start;


-- 6. Window function RANK: messes ranked by rating inside their own type (boys / girls).
--    A window function keeps every row, it only adds the rank column.
SELECT mess_type, mess_name, avg_rating,
       RANK() OVER (PARTITION BY mess_type ORDER BY avg_rating DESC) AS rank_in_type
FROM v_mess_summary
WHERE avg_rating IS NOT NULL
ORDER BY mess_type, rank_in_type;


-- 7. ROW_NUMBER: the latest message of every conversation.
SELECT conversation_id, sender_id, body, sent_at
FROM (SELECT m.*,
             ROW_NUMBER() OVER (PARTITION BY m.conversation_id ORDER BY m.sent_at DESC) AS rn
        FROM messages AS m) AS ranked
WHERE rn = 1
ORDER BY conversation_id;


-- 8. Running total and the change from the last month (SUM OVER and LAG).
WITH RECURSIVE months AS (
    SELECT DATE('2026-01-01') AS month_start
    UNION ALL
    SELECT DATE_ADD(month_start, INTERVAL 1 MONTH) FROM months WHERE month_start < '2026-11-01'
),
monthly AS (
    SELECT mo.month_start, COALESCE(SUM(p.amount), 0) AS collected
    FROM months AS mo
    LEFT JOIN payments AS p
           ON p.paid_at >= mo.month_start
          AND p.paid_at <  DATE_ADD(mo.month_start, INTERVAL 1 MONTH)
    GROUP BY mo.month_start
)
SELECT DATE_FORMAT(month_start, '%b %Y')                          AS month,
       collected,
       SUM(collected) OVER (ORDER BY month_start)                 AS running_total,
       collected - LAG(collected) OVER (ORDER BY month_start)     AS change_from_last_month
FROM monthly
ORDER BY month_start;


-- 9. AVG OVER a partition: every seat next to the average rent of its own mess.
SELECT me.mess_name, s.seat_label, s.monthly_rent,
       ROUND(AVG(s.monthly_rent) OVER (PARTITION BY me.mess_id), 0) AS mess_average,
       s.monthly_rent - ROUND(AVG(s.monthly_rent) OVER (PARTITION BY me.mess_id), 0) AS difference
FROM seats AS s
JOIN rooms  AS r  ON r.room_id  = s.room_id
JOIN messes AS me ON me.mess_id = r.mess_id
WHERE me.mess_id = 1
ORDER BY s.monthly_rent DESC;
