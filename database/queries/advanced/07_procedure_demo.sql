-- ====================================================================
-- Stored procedure demo
-- Run the calls from top to bottom, one block at a time.
--
-- WARNING: unlike the other demo files, these calls CHANGE the data for good
-- (every procedure has its own transaction and commits at the end).
-- To get the original demo data back, rebuild the database:
--     powershell -ExecutionPolicy Bypass -File .\scripts\setup_database.ps1 -Reset
-- ====================================================================
USE mess_finder;


-- 1. The manager of Rahman Boys Mess (user 2) gives seat 5 (room 102, seat B) to
--    student Rafsan Jani (user 28). Name, phone and gender come from the account.
CALL sp_add_member(2, 5, 28, NULL, NULL, NULL, 'Student', NULL, 3500, 'cash', '2026-11-22', @member_id);
SELECT @member_id AS new_member_id;

--    What happened in the same transaction?
SELECT status FROM seats WHERE seat_id = 5;                                    -- booked
SELECT due_month, amount, due_date, status FROM rent_dues WHERE member_id = @member_id;   -- full month rent
SELECT amount, payment_type, method FROM payments WHERE member_id = @member_id;           -- advance received
SELECT message FROM notifications WHERE user_id = 28 ORDER BY notification_id DESC LIMIT 1;


-- 2. The same seat again. The procedure refuses and nothing is changed.
--    Error 1644: This seat is not available
CALL sp_add_member(2, 5, NULL, 'Another Person', '01700000010', 'male', NULL, NULL, 0, 'cash', '2026-11-22', @member_id2);


-- 3. A different manager cannot give away this mess's seat.
--    Error 1644: This seat does not belong to your mess
CALL sp_add_member(3, 7, NULL, 'Another Person', '01700000010', 'male', NULL, NULL, 0, 'cash', '2026-11-22', @member_id2);


-- 4. A wrong member rolls everything back (the gender rule is a trigger inside the transaction).
--    Error 1644: Gender does not match the mess type
CALL sp_add_member(2, 7, NULL, 'Girl Test', '01700000011', 'female', NULL, NULL, 0, 'cash', '2026-11-22', @member_id2);
SELECT status FROM seats WHERE seat_id = 7;                                    -- still available


-- 5. Record payments. Sumon Ahmed (member 3) owes the rent of October and November.
SET @october = (SELECT due_id FROM rent_dues WHERE member_id = 3 AND due_month = '2026-10-01');
CALL sp_record_payment(2, 3, @october, 1000, 'bkash', NULL, @payment_id);
SELECT status FROM rent_dues WHERE due_id = @october;                         -- partial
CALL sp_record_payment(2, 3, @october, 2000, 'cash', NULL, @payment_id);
SELECT status FROM rent_dues WHERE due_id = @october;                         -- paid
--    Paying more than the due is refused:
--    Error 1644: Payment is more than the remaining due
CALL sp_record_payment(2, 3, @october, 1, 'cash', NULL, @payment_id);


-- 3b. How much does Sumon still owe?
SELECT fn_member_outstanding(3) AS sumon_owes;


-- 6. The member leaves. The seat is free again and the student is told.
CALL sp_mark_member_left(2, @member_id, '2026-11-23');
SELECT status, leave_date FROM mess_members WHERE member_id = @member_id;
SELECT status FROM seats WHERE seat_id = 5;                                    -- available


-- 7. Make the rent dues of December for every member (a cursor goes through the members).
CALL sp_generate_monthly_dues('2026-12-01', @created);
SELECT @created AS dues_created;
CALL sp_generate_monthly_dues('2026-12-01', @created);                         -- second run: nothing new
SELECT @created AS dues_created_second_time;


-- 8. Mark dues as overdue. We pretend today is 30 November 2026 for this session only.
SET timestamp = UNIX_TIMESTAMP('2026-11-30 00:10:00');
CALL sp_process_overdue_dues(@marked);
SELECT @marked AS marked_overdue;
SET timestamp = DEFAULT;


-- 9. The Interested button: first call adds, second call removes.
CALL sp_toggle_interest(31, 1, 1, @interested);
SELECT @interested AS now_interested;                                          -- 1
CALL sp_toggle_interest(31, 1, 1, @interested);
SELECT @interested AS now_interested;                                          -- 0


-- 10. The Chat button: the same chat is found again, no duplicate is made.
CALL sp_get_or_create_conversation(4, 31, @chat_id);
SELECT @chat_id AS chat_id;
CALL sp_get_or_create_conversation(4, 31, @chat_id);
SELECT @chat_id AS same_chat_id;


-- 11. A vacancy post with two seats. The seat list is a JSON array.
CALL sp_create_vacancy_post(2, 'Two seats in Mirpur', 'Quiet rooms, water all day.', '2026-12-05', '[7, 8]', @post_id);
SELECT p.post_id, p.title, s.seat_label, s.monthly_rent
FROM vacancy_posts AS p
JOIN post_seats AS ps ON ps.post_id = p.post_id
JOIN seats AS s ON s.seat_id = ps.seat_id
WHERE p.post_id = @post_id;


-- 12. Old posts expire. We pretend it is 20 December 2026 for this session only.
SET timestamp = UNIX_TIMESTAMP('2026-12-20 01:00:00');
CALL sp_expire_old_posts(@vacancy, @wanted);
SELECT @vacancy AS vacancy_posts_expired, @wanted AS seat_wanted_posts_expired;
SET timestamp = DEFAULT;
