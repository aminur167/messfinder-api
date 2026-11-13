-- ====================================================================
-- v_member_dues
-- One row per member with the money side: how much was due, how much was
-- paid, what is still owed, and the status of this month's rent.
-- Used by: Manager Members page, Manager dashboard, student's My mess page.
-- ====================================================================
USE mess_finder;

CREATE OR REPLACE VIEW v_member_dues AS
WITH paid_per_due AS (
    -- money received for each due (advance payments have no due, so they are left out)
    SELECT due_id, SUM(amount) AS paid
    FROM payments
    WHERE due_id IS NOT NULL
    GROUP BY due_id
),
totals_per_member AS (
    SELECT d.member_id,
           SUM(d.amount)                AS total_due,
           SUM(COALESCE(p.paid, 0))     AS total_paid,
           SUM(d.status = 'overdue')    AS overdue_count
    FROM rent_dues AS d
    LEFT JOIN paid_per_due AS p ON p.due_id = d.due_id
    GROUP BY d.member_id
)
SELECT m.member_id,
       r.mess_id,
       m.full_name,
       m.phone,
       m.student_id,
       r.room_no,
       s.seat_label,
       m.monthly_rent,
       m.status                                           AS member_status,
       m.join_date,
       m.leave_date,
       COALESCE(t.total_due, 0)                           AS total_due,
       COALESCE(t.total_paid, 0)                          AS total_paid,
       COALESCE(t.total_due, 0) - COALESCE(t.total_paid, 0) AS outstanding,
       COALESCE(t.overdue_count, 0)                       AS overdue_count,
       cm.status                                          AS current_month_status
FROM mess_members AS m
JOIN seats AS s ON s.seat_id = m.seat_id
JOIN rooms AS r ON r.room_id = s.room_id
LEFT JOIN totals_per_member AS t ON t.member_id = m.member_id
LEFT JOIN rent_dues AS cm
       ON cm.member_id = m.member_id
      AND cm.due_month = DATE_FORMAT(CURDATE(), '%Y-%m-01');
