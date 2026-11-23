-- ====================================================================
-- Integrity demo: statements that the database REFUSES on purpose.
-- Run them one at a time (select one statement, press Ctrl+Enter).
-- Each statement ends with an error, and nothing is changed.
-- The comment above each statement says which rule stops it.
-- ====================================================================
USE mess_finder;


-- 1. UNIQUE: an email can be used only once.
--    Error 1062: Duplicate entry ... for key 'users.uq_users_email'
INSERT INTO users (full_name, email, phone, password_hash, role)
VALUES ('Test User', 'rafiul.islam@example.com', '01799999999', 'x', 'student');


-- 2. One active member per seat (generated column + UNIQUE).
--    Seat 1 already has an active member.
--    Error 1062: Duplicate entry '1' for key 'mess_members.uq_mess_members_active_seat'
INSERT INTO mess_members (seat_id, full_name, phone, gender, monthly_rent, join_date)
VALUES (1, 'Test Person', '01700000000', 'male', 3000, '2026-11-22');


-- 3. Composite foreign key: user 2 is a manager, so he cannot get a student profile.
--    Error 1452: Cannot add or update a child row ... CONSTRAINT 'fk_student_profiles_user'
INSERT INTO student_profiles (student_id, university_id, gender)
VALUES (2, 1, 'male');


-- 4. Composite foreign key: a payment must settle the due of the same member.
--    Due 1 belongs to member 1, but this payment says member 2.
--    Error 1452: ... CONSTRAINT 'fk_payments_due'
INSERT INTO payments (member_id, due_id, amount, payment_type, method, paid_at)
VALUES (2, 1, 500, 'monthly', 'cash', '2026-11-22 10:00:00');


-- 5. CHECK: a monthly payment needs a due.
--    Error 3819: Check constraint 'chk_pay_due' is violated.
INSERT INTO payments (member_id, due_id, amount, payment_type, method, paid_at)
VALUES (1, NULL, 500, 'monthly', 'cash', '2026-11-22 10:00:00');


-- 6. CHECK: rent must be positive.
--    Error 3819: Check constraint 'chk_seat_rent' is violated.
UPDATE seats SET monthly_rent = -100 WHERE seat_id = 1;


-- 7. CHECK: a left member must have a leave date.
--    Error 3819: Check constraint 'chk_member_leave' is violated.
UPDATE mess_members SET status = 'left' WHERE member_id = 1;


-- 8. CHECK: due month must be the first day of a month.
--    Error 3819: Check constraint 'chk_due_month' is violated.
INSERT INTO rent_dues (member_id, due_month, amount, due_date)
VALUES (1, '2026-12-05', 3000, '2026-12-15');


-- 9. CHECK: rating must be from 1 to 5.
--    Error 3819: Check constraint 'chk_rating' is violated.
INSERT INTO reviews (mess_id, student_id, rating)
VALUES (1, 13, 6);


-- 10. CHECK: a comment belongs to exactly one post (here it names two).
--     Error 3819: Check constraint 'chk_one_post' is violated.
INSERT INTO post_comments (user_id, vacancy_post_id, wanted_post_id, body)
VALUES (8, 1, 1, 'This comment names two posts');


-- 11. Composite foreign key: post 1 belongs to mess 1, so it cannot be used for mess 2.
--     Error 1452: ... CONSTRAINT 'fk_interests_post'
INSERT INTO interests (student_id, mess_id, post_id)
VALUES (31, 2, 1);


-- 12. RESTRICT: a mess that still has rooms, posts and members cannot be deleted.
--     We use soft delete instead (messes.status = 'closed').
--     Error 1451: Cannot delete or update a parent row ...
DELETE FROM messes WHERE mess_id = 1;


-- 13. RESTRICT: a user who has a profile, complaints and members linked to him cannot be deleted.
--     Block the user instead (users.is_active = 0).
--     Error 1451: Cannot delete or update a parent row ...
DELETE FROM users WHERE user_id = 8;
