-- ====================================================================
-- Mess Finder demo data - Newsfeed, comments and interests
-- Tables: vacancy_posts, post_seats, seat_wanted_posts, post_comments, interests
-- Post 5 is expired and post 6 is closed, so the feed shows every status.
-- Run after the schema files. Load the seed files in number order.
-- ====================================================================
USE mess_finder;

-- Vacancy posts (made by managers)
INSERT INTO vacancy_posts (post_id, mess_id, title, description, available_from, status, created_at) VALUES
    (1, 1, 'Seats available in Mirpur 10 boys mess', 'Two seats are free from 1 December. Water, gas and a quiet study environment.', '2026-12-01', 'open', '2026-11-10 12:00:00'),
    (2, 2, 'Two seats near DIU in Dhanmondi', 'Meals included. Walking distance from Daffodil International University.', '2026-12-01', 'open', '2026-11-12 11:00:00'),
    (3, 4, 'Seats near NSU and IUB', 'Wifi and utility bills are included in the rent. Rooftop access for everyone.', '2026-11-25', 'open', '2026-11-15 15:00:00'),
    (4, 3, 'Girls mess in Mohammadpur has seats', 'Safe building with a guard and CCTV. Meals are included.', '2026-12-01', 'open', '2026-11-18 10:00:00'),
    (5, 5, 'Seats in Sunrise Ladies Mess, Uttara', 'Seats free from the first of November. Generator and meals included.', '2026-11-01', 'expired', '2026-10-05 10:00:00'),
    (6, 1, 'One seat free in room 102', 'A single seat in room 102 is free this month.', '2026-08-05', 'closed', '2026-07-20 10:00:00');

-- Seats advertised in each vacancy post
INSERT INTO post_seats (post_id, seat_id) VALUES
    (1, 5),
    (1, 7),
    (1, 8),
    (2, 15),
    (2, 18),
    (3, 31),
    (3, 36),
    (4, 23),
    (4, 26),
    (5, 42),
    (5, 44),
    (6, 5);

-- Seat wanted posts (made by students)
INSERT INTO seat_wanted_posts (wanted_id, student_id, title, description, area_id, university_id, budget_min, budget_max, mess_type, needed_from, status, created_at) VALUES
    (1, 28, 'Need a seat near DU from December', 'Second year student. Quiet and tidy. Looking for a boys mess close to Shahbag.', 8, 2, 3000, 4000, 'boys', '2026-12-01', 'open', '2026-11-14 18:00:00'),
    (2, 29, 'Looking for a girls mess near BRAC', 'Need a safe girls mess in or around Badda. Meals are a plus.', 6, 4, 3500, 4500, 'girls', '2026-12-01', 'open', '2026-11-16 20:00:00'),
    (3, 16, 'Moved out, need a new mess in Mirpur', 'I want to stay close to my previous area. Can pay on the first week of every month.', 1, 2, 3000, 3800, 'boys', '2026-11-25', 'open', '2026-11-19 21:00:00'),
    (4, 30, 'Seat needed near NSU', 'Found one now, will update if needed.', 5, 3, 4000, 5000, 'boys', '2026-12-05', 'closed', '2026-10-20 14:00:00'),
    (5, 23, 'Girls mess near NSU or Mohammadpur', 'Looking for a seat from the end of November.', 3, 3, 3500, 4500, 'girls', '2026-11-30', 'open', '2026-11-17 19:00:00');

-- Comments (the duplicate one is soft deleted)
INSERT INTO post_comments (user_id, vacancy_post_id, wanted_post_id, body, created_at, is_deleted) VALUES
    (28, 1, NULL, 'Is the seat available from 1 December?', '2026-11-11 19:00:00', 0),
    (2, 1, NULL, 'Yes, seat B in room 102 is free from 1 December.', '2026-11-11 19:30:00', 0),
    (30, 3, NULL, 'Is wifi included in the rent?', '2026-11-15 20:00:00', 0),
    (5, 3, NULL, 'Wifi and utility bills are included.', '2026-11-15 20:20:00', 0),
    (29, 4, NULL, 'Are visitors allowed in the mess?', '2026-11-18 21:10:00', 0),
    (4, 4, NULL, 'Visitors are allowed in the ground floor lobby until 8 pm.', '2026-11-18 21:40:00', 0),
    (22, 4, NULL, 'Duplicate comment, ignore.', '2026-11-18 22:00:00', 1),
    (2, NULL, 3, 'We have seats in Mirpur 10. Please check our mess.', '2026-11-20 12:05:00', 0),
    (3, NULL, 1, 'Our seats start from 4,500, a little above your budget.', '2026-11-14 19:00:00', 0);

-- Interested list
INSERT INTO interests (student_id, mess_id, post_id, created_at) VALUES
    (28, 1, 1, '2026-11-10 20:00:00'),
    (28, 2, 2, '2026-11-12 16:50:00'),
    (30, 4, 3, '2026-11-15 19:50:00'),
    (30, 2, NULL, '2026-11-14 12:00:00'),
    (16, 1, 1, '2026-11-19 22:00:00'),
    (16, 4, NULL, '2026-11-19 22:10:00'),
    (23, 3, 4, '2026-11-18 20:00:00'),
    (29, 3, 4, '2026-11-18 20:30:00'),
    (29, 5, 5, '2026-10-08 10:00:00');
