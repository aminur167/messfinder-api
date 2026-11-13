-- ====================================================================
-- v_overdue_dues
-- Rent that nobody has paid after the deadline (status = overdue),
-- with the member, seat and how many days late.
-- Used by: Manager "Members with dues" list and the admin report.
-- ====================================================================
USE mess_finder;

CREATE OR REPLACE VIEW v_overdue_dues AS
SELECT d.due_id,
       d.member_id,
       r.mess_id,
       m.full_name,
       m.phone,
       m.student_id,
       r.room_no,
       s.seat_label,
       d.due_month,
       d.amount,
       d.due_date,
       DATEDIFF(CURDATE(), d.due_date) AS days_late
FROM rent_dues AS d
JOIN mess_members AS m ON m.member_id = d.member_id
JOIN seats AS s ON s.seat_id = m.seat_id
JOIN rooms AS r ON r.room_id = s.room_id
WHERE d.status = 'overdue';
