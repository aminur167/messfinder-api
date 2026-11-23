-- ====================================================================
-- Basic INSERT, UPDATE and DELETE examples
-- Every example runs inside a transaction and ends with ROLLBACK,
-- so you can run it as many times as you like and the data stays the same.
-- Select one whole block (from START TRANSACTION to ROLLBACK) and run it.
-- ====================================================================
USE mess_finder;


-- 1. INSERT: add a new area.
START TRANSACTION;
INSERT INTO areas (area_name, city) VALUES ('Banani', 'Dhaka');
SELECT * FROM areas ORDER BY area_id DESC LIMIT 3;
ROLLBACK;


-- 2. INSERT: add a facility and give it to a mess.
START TRANSACTION;
INSERT INTO facilities (facility_name) VALUES ('Prayer room');
INSERT INTO mess_facilities (mess_id, facility_id)
VALUES (1, LAST_INSERT_ID());                 -- LAST_INSERT_ID() = id of the facility just added
SELECT f.facility_name
FROM mess_facilities AS mf
JOIN facilities AS f ON f.facility_id = mf.facility_id
WHERE mf.mess_id = 1;
ROLLBACK;


-- 3. UPDATE: change the rent of one seat (room 101, seat A of Rahman Boys Mess).
--    Old members keep the rent they joined with, because it is saved in mess_members.
START TRANSACTION;
UPDATE seats SET monthly_rent = 3300 WHERE seat_id = 1;
SELECT seat_id, seat_label, monthly_rent FROM seats WHERE seat_id = 1;
ROLLBACK;


-- 4. UPDATE: "delete" a seat the soft way. We mark it inactive instead of removing the row,
--    so the history of members and posts that used it stays safe.
START TRANSACTION;
UPDATE seats SET status = 'inactive' WHERE seat_id = 5;
SELECT seat_id, seat_label, status FROM seats WHERE seat_id = 5;
ROLLBACK;


-- 5. UPDATE: block a user. The account stays in the table, only is_active changes.
START TRANSACTION;
UPDATE users SET is_active = 0 WHERE user_id = 9;
SELECT user_id, full_name, is_active FROM users WHERE user_id = 9;
ROLLBACK;


-- 6. UPDATE many rows: close all posts older than 30 days that are still open.
--    (Later an event will do this every day.)
START TRANSACTION;
UPDATE vacancy_posts
SET status = 'expired'
WHERE status = 'open' AND created_at < DATE_SUB('2026-11-22', INTERVAL 30 DAY);
SELECT post_id, title, status FROM vacancy_posts ORDER BY post_id;
ROLLBACK;


-- 7. DELETE: remove a real link row. This is allowed because a link row has no history.
START TRANSACTION;
DELETE FROM mess_facilities WHERE mess_id = 1 AND facility_id = 10;
SELECT COUNT(*) AS facilities_left FROM mess_facilities WHERE mess_id = 1;
ROLLBACK;


-- 8. DELETE the Interested mark (the student pressed the button again).
START TRANSACTION;
DELETE FROM interests WHERE student_id = 28 AND mess_id = 1;
SELECT student_id, mess_id FROM interests WHERE student_id = 28;
ROLLBACK;
