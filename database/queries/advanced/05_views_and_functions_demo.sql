-- ====================================================================
-- Using the views and functions
-- A view is a saved query: the website reads it like a table.
-- ====================================================================
USE mess_finder;


-- Browse page: mess cards with free seats and rating.
SELECT mess_name, area_name, min_rent, max_rent, free_seats, avg_rating, review_count
FROM v_mess_summary
WHERE status = 'verified'
ORDER BY avg_rating DESC;

-- Browse page: only boys messes in the 3500 - 4500 range that have a free seat.
SELECT DISTINCT mess_name, area_name
FROM v_available_seats
WHERE mess_type = 'boys' AND monthly_rent BETWEEN 3500 AND 4500;

-- Mess details page: the History section (numbers only).
SELECT * FROM v_mess_history WHERE mess_id = 1;

-- Manager dashboard: the overview cards of every mess.
SELECT * FROM v_manager_stats;

-- Manager Members page: who owes money, biggest first.
SELECT full_name, room_no, seat_label, current_month_status, outstanding
FROM v_member_dues
WHERE mess_id = 2 AND outstanding > 0
ORDER BY outstanding DESC;

-- Manager Room-wise seats page: the rooms of Campus Corner.
SELECT room_no, seat_label, seat_status, member_name
FROM v_room_seat_status
WHERE mess_id = 4
ORDER BY room_no, seat_label;

-- Overdue rent with the days late.
SELECT full_name, due_month, amount, days_late
FROM v_overdue_dues
ORDER BY days_late DESC
LIMIT 10;

-- Newsfeed: the newest 5 posts.
SELECT post_type, author_name, title, comment_count, interest_count
FROM v_newsfeed
ORDER BY created_at DESC
LIMIT 5;


-- Functions
SELECT fn_avg_rating(1)                                                    AS rating_of_mess_1,
       fn_available_seats(1)                                               AS free_seats_of_mess_1,
       fn_member_outstanding(3)                                            AS sumon_owes,
       fn_distance_km(23.7265, 90.3926, 23.7336, 90.3925)                  AS buet_to_du_km,
       fn_first_due_date('2026-11-18')                                     AS deadline_if_joining_18_nov;

-- A function inside a WHERE: members who owe more than one month of their rent.
SELECT member_id, full_name, monthly_rent, fn_member_outstanding(member_id) AS owes
FROM mess_members
WHERE status = 'active'
  AND fn_member_outstanding(member_id) > monthly_rent;
