-- ====================================================================
-- Subquery examples: scalar, IN, EXISTS, NOT EXISTS, correlated,
-- derived table and ALL.
-- A subquery is a query inside another query.
-- ====================================================================
USE mess_finder;


-- 1. Scalar subquery (returns one value).
--    Seats that cost less than the average seat rent of the whole system.
SELECT s.seat_id, s.seat_label, s.monthly_rent
FROM seats AS s
WHERE s.monthly_rent < (SELECT AVG(monthly_rent) FROM seats)
ORDER BY s.monthly_rent
LIMIT 10;


-- 2. IN with a subquery.
--    Students who pressed Interested on a mess in Mirpur.
SELECT DISTINCT u.full_name
FROM interests AS i
JOIN users AS u ON u.user_id = i.student_id
WHERE i.mess_id IN (SELECT mess_id
                      FROM messes
                     WHERE area_id = (SELECT area_id FROM areas WHERE area_name = 'Mirpur'));


-- 3. EXISTS.
--    Verified messes that have at least one free seat right now.
SELECT me.mess_name
FROM messes AS me
WHERE me.status = 'verified'
  AND EXISTS (SELECT 1
                FROM rooms AS r
                JOIN seats AS s ON s.room_id = r.room_id
               WHERE r.mess_id = me.mess_id
                 AND s.status = 'available');


-- 4. NOT EXISTS.
--    Verified messes that never made a vacancy post.
SELECT me.mess_name
FROM messes AS me
WHERE me.status = 'verified'
  AND NOT EXISTS (SELECT 1 FROM vacancy_posts AS vp WHERE vp.mess_id = me.mess_id);


-- 5. Correlated subquery (uses a column of the outer query, so it runs once per outer row).
--    The most expensive free seat of each mess.
SELECT me.mess_name, r.room_no, s.seat_label, s.monthly_rent
FROM seats AS s
JOIN rooms  AS r  ON r.room_id  = s.room_id
JOIN messes AS me ON me.mess_id = r.mess_id
WHERE s.status = 'available'
  AND s.monthly_rent = (SELECT MAX(s2.monthly_rent)
                          FROM seats AS s2
                          JOIN rooms AS r2 ON r2.room_id = s2.room_id
                         WHERE r2.mess_id = r.mess_id
                           AND s2.status = 'available')
ORDER BY me.mess_name;


-- 6. Derived table (a subquery in FROM).
--    Messes whose average seat rent is above the average of all seats.
SELECT t.mess_name, ROUND(t.avg_rent, 0) AS avg_rent
FROM (SELECT me.mess_id, me.mess_name, AVG(s.monthly_rent) AS avg_rent
        FROM messes AS me
        JOIN rooms AS r ON r.mess_id = me.mess_id
        JOIN seats AS s ON s.room_id = r.room_id
       GROUP BY me.mess_id, me.mess_name) AS t
WHERE t.avg_rent > (SELECT AVG(monthly_rent) FROM seats)
ORDER BY t.avg_rent DESC;


-- 7. > ALL.
--    Seats that cost more than every seat in the Mirpur mess.
SELECT me.mess_name, s.seat_label, s.monthly_rent
FROM seats AS s
JOIN rooms  AS r  ON r.room_id  = s.room_id
JOIN messes AS me ON me.mess_id = r.mess_id
WHERE s.monthly_rent > ALL (SELECT s2.monthly_rent
                              FROM seats AS s2
                              JOIN rooms AS r2 ON r2.room_id = s2.room_id
                              JOIN messes AS m2 ON m2.mess_id = r2.mess_id
                             WHERE m2.area_id = (SELECT area_id FROM areas WHERE area_name = 'Mirpur'))
ORDER BY s.monthly_rent DESC;


-- 8. A subquery in the SELECT list.
--    For each manager: how many notifications are still unread.
SELECT u.full_name,
       (SELECT COUNT(*)
          FROM notifications AS n
         WHERE n.user_id = u.user_id AND n.is_read = 0) AS unread
FROM users AS u
WHERE u.role = 'manager'
ORDER BY unread DESC, u.full_name;
