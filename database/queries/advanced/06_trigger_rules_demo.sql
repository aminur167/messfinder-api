-- ====================================================================
-- Trigger demo, part 1: statements the triggers REFUSE.
-- Run one statement at a time. Each one fails with the message in the comment,
-- and nothing is changed.
-- ====================================================================
USE mess_finder;


-- 1. Gender rule: Rahman Boys Mess is a boys mess.
--    Error 1644: Gender does not match the mess type
INSERT INTO mess_members (seat_id, full_name, phone, gender, monthly_rent, join_date)
VALUES (5, 'Test Person', '01700000001', 'female', 3500, '2026-11-22');

-- 2. A girl's account cannot be added as a boy.
--    Error 1644: Member gender does not match the student account
INSERT INTO mess_members (seat_id, student_id, full_name, phone, gender, monthly_rent, join_date)
VALUES (5, 29, 'Anika Tabassum', '01711000029', 'male', 3500, '2026-11-22');

-- 3. A taken seat cannot get a second member.
--    Error 1644: This seat is not available
INSERT INTO mess_members (seat_id, full_name, phone, gender, monthly_rent, join_date)
VALUES (1, 'Test Person', '01700000001', 'male', 3500, '2026-11-22');

-- 4. A seat with a living member cannot be switched off.
--    Error 1644: This seat has an active member
UPDATE seats SET status = 'inactive' WHERE seat_id = 1;

-- 5. A payment cannot be bigger than what is still due (due 1 is already fully paid).
--    Error 1644: Payment is more than the remaining due
INSERT INTO payments (member_id, due_id, amount, payment_type, method, paid_at)
VALUES (1, 1, 1, 'monthly', 'cash', NOW());

-- 6. Only a person who lived in the mess can review it.
--    Error 1644: Only current or past members of this mess can write a review
INSERT INTO reviews (mess_id, student_id, rating) VALUES (1, 28, 4);

-- 7. Only the two people of a chat can write in it (user 9 is not in conversation 1).
--    Error 1644: Sender is not part of this conversation
INSERT INTO messages (conversation_id, sender_id, body) VALUES (1, 9, 'Hello');

-- 8. A post can contain only free seats of its own mess.
--    Error 1644: This seat belongs to another mess   (seat 15 is in Green Nest)
INSERT INTO post_seats (post_id, seat_id) VALUES (1, 15);
--    Error 1644: Only free seats can be posted        (seat 1 is taken)
INSERT INTO post_seats (post_id, seat_id) VALUES (1, 1);

-- 9. A mess that is not verified cannot post, be marked as Interested or be visited.
--    Error 1644: Only a verified mess can make a post
INSERT INTO vacancy_posts (mess_id, title, available_from) VALUES (6, 'Test', '2026-12-01');
--    Error 1644: Only a verified mess can be marked as Interested
INSERT INTO interests (student_id, mess_id) VALUES (28, 6);

-- 10. Nobody can comment on an expired post (post 5 is expired).
--     Error 1644: Comments are closed for this post
INSERT INTO post_comments (user_id, vacancy_post_id, body) VALUES (28, 5, 'Is it still free?');

-- 11. A visit must be in the future.
--     Error 1644: Visit time must be in the future
INSERT INTO visit_requests (student_id, mess_id, visit_time) VALUES (28, 1, '2026-01-01 10:00:00');

-- 12. A member's seat cannot be changed, and someone who left cannot come back as the same row.
--     Error 1644: The seat of a member cannot be changed
UPDATE mess_members SET seat_id = 5 WHERE member_id = 1;
--     Error 1644: A member who left cannot be activated again, add a new member
UPDATE mess_members SET status = 'active', leave_date = NULL WHERE member_id = 6;


-- ====================================================================
-- Trigger demo, part 2: triggers that keep other tables in step.
-- Each block is inside a transaction and ends with ROLLBACK, so nothing stays.
-- Select the whole block (START TRANSACTION to ROLLBACK) and run it.
-- ====================================================================

-- A. Changing the rent of a seat writes a line in seat_rent_log.
START TRANSACTION;
UPDATE seats SET monthly_rent = 3300 WHERE seat_id = 1;
SELECT seat_id, old_rent, new_rent FROM seat_rent_log WHERE seat_id = 1 ORDER BY log_id DESC LIMIT 1;
ROLLBACK;

-- B. When the last free seat of a vacancy post is taken, the post closes by itself.
--    Post 2 advertises seats 15 and 18.
START TRANSACTION;
UPDATE seats SET status = 'booked' WHERE seat_id = 15;
SELECT post_id, status FROM vacancy_posts WHERE post_id = 2;     -- still open, seat 18 is free
UPDATE seats SET status = 'booked' WHERE seat_id = 18;
SELECT post_id, status FROM vacancy_posts WHERE post_id = 2;     -- closed now
ROLLBACK;

-- C. A new chat message updates the conversation and tells the other person (once).
START TRANSACTION;
INSERT INTO messages (conversation_id, sender_id, body) VALUES (2, 30, 'Is the room still free?');
INSERT INTO messages (conversation_id, sender_id, body) VALUES (2, 30, 'Please reply when you can.');
SELECT conversation_id, last_message_at FROM conversations WHERE conversation_id = 2;
SELECT message FROM notifications WHERE user_id = 5 AND is_read = 0 ORDER BY notification_id DESC LIMIT 2;
ROLLBACK;

-- D. The last payment turns a partly paid due into a paid one.
--    Nayeem (member 4) paid half of November, the other half is 1750.
START TRANSACTION;
SET @due = (SELECT due_id FROM rent_dues WHERE member_id = 4 AND due_month = '2026-11-01');
SELECT status FROM rent_dues WHERE due_id = @due;               -- partial
INSERT INTO payments (member_id, due_id, amount, payment_type, method, paid_at)
VALUES (4, @due, 1750, 'monthly', 'cash', NOW());
SELECT status FROM rent_dues WHERE due_id = @due;               -- paid
ROLLBACK;

-- E. A member leaves: the seat becomes free and the student is told.
START TRANSACTION;
UPDATE mess_members SET status = 'left', leave_date = '2026-11-22' WHERE member_id = 1;
SELECT seat_id, status FROM seats WHERE seat_id = 1;
SELECT message FROM notifications WHERE user_id = 8 ORDER BY notification_id DESC LIMIT 1;
ROLLBACK;
