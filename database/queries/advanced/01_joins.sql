-- ====================================================================
-- JOIN examples: INNER, LEFT, RIGHT, SELF and CROSS
-- Each query answers one plain question. Run one query at a time.
-- ====================================================================
USE mess_finder;


-- 1. INNER JOIN over four tables.
--    Who lives where? Only rows that match in every table are shown.
SELECT me.mess_name, r.room_no, s.seat_label, m.full_name, m.join_date
FROM mess_members AS m
JOIN seats  AS s  ON s.seat_id  = m.seat_id
JOIN rooms  AS r  ON r.room_id  = s.room_id
JOIN messes AS me ON me.mess_id = r.mess_id
WHERE m.status = 'active'
ORDER BY me.mess_name, r.room_no, s.seat_label;


-- 2. LEFT JOIN.
--    Every seat of Green Nest Mess, also the free ones (living_here is NULL for them).
--    active_seat_id is filled only while a member is active.
SELECT r.room_no, s.seat_label, s.status, m.full_name AS living_here
FROM rooms AS r
JOIN seats AS s ON s.room_id = r.room_id
LEFT JOIN mess_members AS m ON m.active_seat_id = s.seat_id
WHERE r.mess_id = 2
ORDER BY r.room_no, s.seat_label;


-- 3. LEFT JOIN to find what is missing ("anti join").
--    Students who never pressed Interested on any mess.
SELECT u.user_id, u.full_name
FROM student_profiles AS sp
JOIN users AS u ON u.user_id = sp.student_id
LEFT JOIN interests AS i ON i.student_id = sp.student_id
WHERE i.student_id IS NULL
ORDER BY u.full_name;


-- 4. RIGHT JOIN.
--    Every university with the number of students, also universities with no student.
--    (The table after RIGHT JOIN keeps all its rows.)
SELECT u.short_name, COUNT(sp.student_id) AS students
FROM student_profiles AS sp
RIGHT JOIN universities AS u ON u.university_id = sp.university_id
GROUP BY u.university_id, u.short_name
ORDER BY students DESC, u.short_name;


-- 5. SELF JOIN: a table joined with itself.
--    Roommates: pairs of current members who share one room.
--    "b.member_id > a.member_id" makes every pair appear once.
SELECT me.mess_name, r.room_no, a.full_name AS person_one, b.full_name AS person_two
FROM mess_members AS a
JOIN seats AS sa ON sa.seat_id = a.seat_id
JOIN mess_members AS b ON b.status = 'active' AND b.member_id > a.member_id
JOIN seats AS sb ON sb.seat_id = b.seat_id AND sb.room_id = sa.room_id
JOIN rooms AS r ON r.room_id = sa.room_id
JOIN messes AS me ON me.mess_id = r.mess_id
WHERE a.status = 'active'
ORDER BY me.mess_name, r.room_no;


-- 6. CROSS JOIN: every area with every mess type.
--    The LEFT JOIN after it counts the verified messes, so a 0 shows a gap.
SELECT a.area_name, t.mess_type, COUNT(me.mess_id) AS verified_messes
FROM areas AS a
CROSS JOIN (SELECT 'boys' AS mess_type UNION SELECT 'girls') AS t
LEFT JOIN messes AS me
       ON me.area_id = a.area_id
      AND me.mess_type = t.mess_type
      AND me.status = 'verified'
GROUP BY a.area_id, a.area_name, t.mess_type
ORDER BY a.area_name, t.mess_type;


-- 7. The inbox of the manager of Rahman Boys Mess (user 2):
--    each chat with the student name and the last message.
SELECT c.conversation_id, u.full_name AS student, m.body AS last_message, c.last_message_at
FROM conversations AS c
JOIN messes   AS me ON me.mess_id = c.mess_id
JOIN users    AS u  ON u.user_id  = c.student_id
JOIN messages AS m  ON m.conversation_id = c.conversation_id
                   AND m.sent_at = c.last_message_at
WHERE me.manager_id = 2
ORDER BY c.last_message_at DESC;


-- 8. Payment history of one member (Sumon Ahmed, member 3) with the due each payment settles.
--    LEFT JOIN because an advance payment has no due.
SELECT p.paid_at, p.amount, p.payment_type, p.method, d.due_month
FROM payments AS p
LEFT JOIN rent_dues AS d ON d.due_id = p.due_id
WHERE p.member_id = 3
ORDER BY p.paid_at;
