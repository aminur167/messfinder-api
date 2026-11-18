-- ====================================================================
-- Mess Finder demo data - Reviews, visit requests and chat
-- Tables: reviews, visit_requests, conversations, messages
-- Only students who lived in a mess (current or ex member) have a review for it.
-- One message is in Bangla to show utf8mb4 works.
-- Run after the schema files. Load the seed files in number order.
-- ====================================================================
USE mess_finder;

-- Reviews with manager replies
INSERT INTO reviews (mess_id, student_id, rating, cleanliness_rating, safety_rating, food_rating, comment, manager_reply, created_at, replied_at) VALUES
    (1, 8, 4, 4, 5, NULL, 'Quiet place, good water supply and the manager is helpful.', 'Thank you Rafiul, glad you like it.', '2026-10-12 20:00:00', '2026-10-13 09:00:00'),
    (1, 16, 4, 3, 4, NULL, 'Lived here for six months. Good value for money.', NULL, '2026-08-05 18:00:00', NULL),
    (1, 9, 3, 3, 4, NULL, 'It is okay, but the gas pressure is low in winter.', 'We are fixing the gas line this month.', '2026-11-03 21:00:00', '2026-11-04 10:00:00'),
    (2, 19, 5, 5, 5, 4, 'Close to my campus and the food is good.', NULL, '2026-09-20 19:00:00', NULL),
    (2, 10, 3, 3, 4, 3, 'Nice location but the rent is on the higher side.', 'Thanks for the feedback.', '2026-10-05 17:00:00', '2026-10-06 11:00:00'),
    (3, 22, 5, 5, 5, 5, 'Feels very safe and the meals are great.', NULL, '2026-09-02 20:00:00', NULL),
    (3, 23, 4, 4, 5, 4, 'Safe for girls and the guard is always on duty.', NULL, '2026-11-02 12:00:00', NULL),
    (3, 27, 4, 4, 4, 3, 'Clean rooms. Dinner could be better.', 'We will talk to the cook.', '2026-10-20 21:00:00', '2026-10-21 10:00:00'),
    (4, 14, 5, 5, 4, NULL, 'Wifi is fast and the university is five minutes away.', NULL, '2026-08-15 22:00:00', NULL),
    (4, 18, 4, 4, 4, NULL, 'Good rooftop. Rooms stay a bit warm in summer.', 'Fans have been replaced since then.', '2026-10-03 16:00:00', '2026-10-04 12:00:00'),
    (5, 24, 5, 5, 5, 4, 'It feels like home.', 'Thank you Mim!', '2026-10-25 20:00:00', '2026-10-26 09:00:00');

-- Visit requests
INSERT INTO visit_requests (student_id, mess_id, visit_time, status, student_note, created_at) VALUES
    (28, 1, '2026-11-24 18:30:00', 'confirmed', 'I will come with a friend.', '2026-11-20 10:10:00'),
    (30, 4, '2026-11-23 17:00:00', 'pending', NULL, '2026-11-21 17:50:00'),
    (29, 3, '2026-11-20 16:00:00', 'completed', 'Friday afternoon.', '2026-11-19 10:05:00'),
    (16, 1, '2026-11-21 15:00:00', 'rejected', 'Manager busy that day.', '2026-11-20 12:40:00'),
    (28, 2, '2026-11-26 11:00:00', 'pending', NULL, '2026-11-21 20:00:00'),
    (23, 3, '2026-11-15 10:00:00', 'cancelled', 'Plans changed.', '2026-11-12 09:00:00');

-- Conversations (last_message_at matches the last message below)
INSERT INTO conversations (conversation_id, mess_id, student_id, last_message_at, created_at) VALUES
    (1, 1, 28, '2026-11-21 09:30:00', '2026-11-11 19:05:00'),
    (2, 4, 30, '2026-11-21 18:00:00', '2026-11-15 20:10:00'),
    (3, 3, 29, '2026-11-19 10:20:00', '2026-11-18 21:00:00'),
    (4, 2, 28, '2026-11-12 17:40:00', '2026-11-12 17:00:00'),
    (5, 1, 16, '2026-11-20 12:35:00', '2026-11-20 12:00:00'),
    (6, 3, 23, '2026-11-16 09:20:00', '2026-11-16 09:00:00');

-- Messages
INSERT INTO messages (conversation_id, sender_id, body, is_read, sent_at) VALUES
    (1, 28, 'Assalamu alaikum, is seat B in room 102 still free?', 1, '2026-11-11 19:05:00'),
    (1, 2, 'Walaikum assalam. Yes, it is free from 1 December.', 1, '2026-11-11 19:20:00'),
    (1, 28, 'Can I come and see the room tomorrow evening?', 1, '2026-11-11 19:25:00'),
    (1, 2, 'Sure, come after 6 pm. Please send a visit request too.', 1, '2026-11-11 19:40:00'),
    (1, 28, 'Done, I have sent the request. Thank you.', 1, '2026-11-20 10:15:00'),
    (1, 2, 'Confirmed. See you on Tuesday evening.', 0, '2026-11-21 09:30:00'),
    (2, 30, 'Hello, is wifi included in the rent?', 1, '2026-11-15 20:10:00'),
    (2, 5, 'Yes, wifi and utility bills are included.', 1, '2026-11-15 20:30:00'),
    (2, 30, 'Great. I will visit on 23 November.', 0, '2026-11-21 18:00:00'),
    (3, 29, 'আপনার মেসে কি এখনো সিট খালি আছে?', 1, '2026-11-18 21:00:00'),
    (3, 4, 'জি, দুইটা সিট খালি আছে। আপনি কোন ইউনিভার্সিটিতে পড়েন?', 1, '2026-11-18 21:30:00'),
    (3, 29, 'BRAC University. Can I visit this week?', 1, '2026-11-19 10:00:00'),
    (3, 4, 'Yes, you are welcome on Friday afternoon.', 0, '2026-11-19 10:20:00'),
    (4, 28, 'Hi, do you have any seat near DU?', 1, '2026-11-12 17:00:00'),
    (4, 3, 'Our seats start from 4,500. That is a bit above your budget.', 1, '2026-11-12 17:40:00'),
    (5, 2, 'Hello Mehedi, we saw your post. We have a seat in Mirpur 10.', 1, '2026-11-20 12:00:00'),
    (5, 16, 'Thanks. What is the rent?', 1, '2026-11-20 12:30:00'),
    (5, 2, '3,500 per month for room 102 seat B.', 0, '2026-11-20 12:35:00'),
    (6, 23, 'Hi, I lived here before. Can I come back in December?', 1, '2026-11-16 09:00:00'),
    (6, 4, 'Of course. Seat C in room 101 will be free.', 1, '2026-11-16 09:20:00');
