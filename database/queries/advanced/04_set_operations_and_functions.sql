-- ====================================================================
-- Set operations, CASE, built-in functions, JSON, full-text and nearby search
-- ====================================================================
USE mess_finder;


-- 1. UNION ALL: the newsfeed. Two kinds of posts under the same columns (see the view v_newsfeed).
SELECT post_type, post_id, author_name, title, created_at
FROM v_newsfeed
WHERE status = 'open'
ORDER BY created_at DESC;


-- 2. UNION (removes duplicates): every student who showed interest in Rahman Boys Mess
--    in any way: pressed Interested, chatted, or asked for a visit.
SELECT student_id FROM interests      WHERE mess_id = 1
UNION
SELECT student_id FROM conversations  WHERE mess_id = 1
UNION
SELECT student_id FROM visit_requests WHERE mess_id = 1;


-- 3. INTERSECT: students who both chatted with a mess AND asked for a visit to it.
SELECT student_id, mess_id FROM conversations
INTERSECT
SELECT student_id, mess_id FROM visit_requests;


-- 4. EXCEPT: students who pressed Interested but never started a chat.
SELECT student_id, mess_id FROM interests
EXCEPT
SELECT student_id, mess_id FROM conversations;


-- 5. CASE WHEN: put every free seat in a price group.
SELECT me.mess_name, s.seat_label, s.monthly_rent,
       CASE
           WHEN s.monthly_rent < 3500 THEN 'budget'
           WHEN s.monthly_rent < 4500 THEN 'standard'
           ELSE 'premium'
       END AS price_group
FROM seats AS s
JOIN rooms  AS r  ON r.room_id  = s.room_id
JOIN messes AS me ON me.mess_id = r.mess_id
WHERE s.status = 'available'
ORDER BY s.monthly_rent;


-- 6. Date functions: how long did the ex-members stay?
SELECT full_name, join_date, leave_date,
       TIMESTAMPDIFF(MONTH, join_date, leave_date) AS months_stayed,
       DATEDIFF(leave_date, join_date)             AS days_stayed,
       DATE_FORMAT(leave_date, '%d %b %Y')         AS left_on
FROM mess_members
WHERE status = 'left'
ORDER BY leave_date;

--    More date functions in one row.
SELECT CURDATE()                              AS today,
       LAST_DAY(CURDATE())                    AS last_day_of_month,
       DATE_ADD(CURDATE(), INTERVAL 10 DAY)   AS ten_days_later,
       DAYNAME('2026-11-24')                  AS day_name,
       DATE_FORMAT(NOW(), '%e %M %Y, %l:%i %p') AS now_text;


-- 7. String functions.
SELECT u.full_name,
       UPPER(u.full_name)                          AS upper_name,
       CHAR_LENGTH(u.full_name)                    AS name_length,
       SUBSTRING_INDEX(u.email, '@', -1)           AS email_domain,
       CONCAT_WS(' - ', sp.department, un.short_name) AS department_and_university,
       LPAD(u.user_id, 5, '0')                     AS padded_id
FROM users AS u
JOIN student_profiles AS sp ON sp.student_id = u.user_id
JOIN universities AS un ON un.university_id = sp.university_id
LIMIT 5;


-- 8. Math functions and NULL functions.
SELECT mess_name,
       ROUND(meal_cost_monthly / 30, 1)  AS meal_cost_per_day,
       CEIL(advance_amount / 1000)       AS advance_in_thousands,
       COALESCE(meal_cost_monthly, 0)    AS meal_cost_or_zero,
       IFNULL(contact_whatsapp, 'none')  AS whatsapp,
       NULLIF(has_meal, 0)               AS meal_flag_or_null
FROM messes;


-- 9. JSON: one row per mess with its facilities as a JSON list.
SELECT me.mess_name,
       JSON_ARRAYAGG(f.facility_name) AS facilities_json
FROM messes AS me
JOIN mess_facilities AS mf ON mf.mess_id = me.mess_id
JOIN facilities AS f ON f.facility_id = mf.facility_id
GROUP BY me.mess_id, me.mess_name;

--    JSON_OBJECT builds one JSON object per free seat.
SELECT JSON_OBJECT('mess', mess_name, 'room', room_no, 'seat', seat_label, 'rent', monthly_rent) AS seat_json
FROM v_available_seats
LIMIT 5;

--    JSON_TABLE turns a JSON list into rows (the procedure sp_create_vacancy_post uses it).
SELECT jt.seat_id, s.seat_label, s.monthly_rent
FROM JSON_TABLE('[5, 7, 8]', '$[*]' COLUMNS (seat_id INT PATH '$')) AS jt
JOIN seats AS s ON s.seat_id = jt.seat_id;


-- 10. Full-text search on the description (uses the FULLTEXT index of messes).
SELECT mess_id, mess_name,
       MATCH(description) AGAINST('wifi rooftop' IN NATURAL LANGUAGE MODE) AS score
FROM messes
WHERE MATCH(description) AGAINST('wifi rooftop' IN NATURAL LANGUAGE MODE)
ORDER BY score DESC;


-- 11. Nearby search: messes within 3 km of North South University (the Haversine function).
SELECT me.mess_name,
       fn_distance_km(u.latitude, u.longitude, me.latitude, me.longitude) AS km_from_university
FROM universities AS u
JOIN messes AS me ON me.status = 'verified'
WHERE u.short_name = 'NSU'
  AND fn_distance_km(u.latitude, u.longitude, me.latitude, me.longitude) <= 3
ORDER BY km_from_university;
