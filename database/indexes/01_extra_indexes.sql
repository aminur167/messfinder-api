-- ====================================================================
-- Extra indexes for the queries the website runs most often.
-- (Primary keys, unique keys and foreign keys already have an index;
--  the tables in schema/ also have a few. These are the ones added on top.)
-- Run indexes/ after seed/, the tables must exist.
-- queries/advanced/09_index_explain_demo.sql shows what an index does with EXPLAIN.
-- ====================================================================
USE mess_finder;

-- Seat counts per room and status (free seats on every mess card)
ALTER TABLE seats
    ADD INDEX idx_seats_room_status (room_id, status);

-- The daily overdue job looks for dues by status and deadline
ALTER TABLE rent_dues
    ADD INDEX idx_rent_dues_status_due_date (status, due_date);

-- Payment history of one member, newest first
ALTER TABLE payments
    ADD INDEX idx_payments_member_paid_at (member_id, paid_at);

-- Newsfeed: open posts, newest first
ALTER TABLE vacancy_posts
    ADD INDEX idx_vacancy_posts_status_created (status, created_at);

ALTER TABLE seat_wanted_posts
    ADD INDEX idx_wanted_posts_status_created (status, created_at);

-- Manager's visit request list
ALTER TABLE visit_requests
    ADD INDEX idx_visit_requests_mess_status_time (mess_id, status, visit_time);

-- Find the members who are still active or already left, by join date
ALTER TABLE mess_members
    ADD INDEX idx_mess_members_status_join_date (status, join_date);
