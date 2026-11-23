-- ====================================================================
-- Basic SELECT examples
-- Each query answers one plain question, so it is easy to explain.
-- Select one query and press Ctrl+Enter in Workbench to run it.
-- ====================================================================
USE mess_finder;


-- 1. Which messes are verified, and in which area are they?
--    Concepts: SELECT, JOIN, WHERE, ORDER BY
SELECT m.mess_id, m.mess_name, a.area_name, m.mess_type
FROM messes AS m
JOIN areas AS a ON a.area_id = m.area_id
WHERE m.status = 'verified'
ORDER BY a.area_name, m.mess_name;


-- 2. Boys messes that serve meals, with the monthly meal cost.
--    Concepts: AND condition
SELECT mess_name, meal_cost_monthly
FROM messes
WHERE mess_type = 'boys' AND has_meal = 1;


-- 3. Search messes by a word in the description.
--    Concepts: LIKE, OR
SELECT mess_id, mess_name
FROM messes
WHERE description LIKE '%wifi%' OR description LIKE '%rooftop%';


-- 4. Free seats that cost between 4000 and 5000, cheapest first.
--    Concepts: BETWEEN, JOIN on three tables
SELECT me.mess_name, r.room_no, s.seat_label, s.monthly_rent
FROM seats AS s
JOIN rooms  AS r  ON r.room_id  = s.room_id
JOIN messes AS me ON me.mess_id = r.mess_id
WHERE s.status = 'available'
  AND s.monthly_rent BETWEEN 4000 AND 5000
ORDER BY s.monthly_rent;


-- 5. Messes in Mirpur or Dhanmondi.
--    Concepts: IN
SELECT m.mess_name, a.area_name
FROM messes AS m
JOIN areas AS a ON a.area_id = m.area_id
WHERE a.area_name IN ('Mirpur', 'Dhanmondi');


-- 6. Which universities do our students come from? (each name once)
--    Concepts: DISTINCT
SELECT DISTINCT u.short_name, u.name
FROM student_profiles AS sp
JOIN universities AS u ON u.university_id = sp.university_id
ORDER BY u.short_name;


-- 7. The five cheapest free seats in verified messes.
--    Concepts: ORDER BY, LIMIT
SELECT me.mess_name, r.room_no, s.seat_label, s.monthly_rent
FROM seats AS s
JOIN rooms  AS r  ON r.room_id  = s.room_id
JOIN messes AS me ON me.mess_id = r.mess_id
WHERE s.status = 'available' AND me.status = 'verified'
ORDER BY s.monthly_rent, me.mess_name
LIMIT 5;


-- 8. How many seats does each mess have, and how many are free or taken?
--    Concepts: COUNT, SUM with a condition, GROUP BY
SELECT me.mess_name,
       COUNT(*)                   AS total_seats,
       SUM(s.status = 'available') AS free_seats,
       SUM(s.status = 'booked')    AS booked_seats
FROM messes AS me
JOIN rooms AS r ON r.mess_id = me.mess_id
JOIN seats AS s ON s.room_id = r.room_id
GROUP BY me.mess_id, me.mess_name
ORDER BY me.mess_name;


-- 9. Members who do not have an account on the website.
--    Concepts: IS NULL
SELECT member_id, full_name, phone, occupation
FROM mess_members
WHERE student_id IS NULL;


-- 10. Rent that is overdue, with the member name and the amount.
--     Concepts: JOIN, WHERE on a status, ORDER BY
SELECT m.full_name, d.due_month, d.amount, d.due_date
FROM rent_dues AS d
JOIN mess_members AS m ON m.member_id = d.member_id
WHERE d.status = 'overdue'
ORDER BY d.due_date, m.full_name;


-- 11. Unread notifications of the manager of Rahman Boys Mess (user 2).
--     Concepts: WHERE with two conditions, ORDER BY newest first
SELECT notification_id, message, created_at
FROM notifications
WHERE user_id = 2 AND is_read = 0
ORDER BY created_at DESC;


-- 12. Find a student by the start of the phone number.
--     A manager does this when linking a member to a student account.
--     Concepts: LIKE with a prefix
SELECT u.user_id, u.full_name, u.phone
FROM users AS u
WHERE u.role = 'student' AND u.phone LIKE '017110000%'
ORDER BY u.phone
LIMIT 10;
