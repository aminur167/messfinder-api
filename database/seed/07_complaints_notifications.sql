-- ====================================================================
-- Mess Finder demo data - Complaints and notifications
-- Tables: complaints, notifications
-- Notifications will be created by triggers later; these rows are only demo history.
-- Run after the schema files. Load the seed files in number order.
-- ====================================================================
USE mess_finder;

-- Complaints
INSERT INTO complaints (complainant_id, against_user_id, mess_id, subject, description, status, admin_note, created_at, resolved_at) VALUES
    (8, NULL, 1, 'Water supply stopped for two days', 'The pump in the building was broken and nobody fixed it for two days.', 'resolved', 'Manager repaired the pump on 6 November.', '2026-11-04 08:30:00', '2026-11-07 14:00:00'),
    (30, 5, 4, 'Rent was higher than the post', 'The post said 4,200 but I was asked for 4,500.', 'in_review', NULL, '2026-11-18 16:00:00', NULL),
    (2, 9, 1, 'Rent unpaid for two months', 'Sumon Ahmed has not paid the October and November rent.', 'open', NULL, '2026-11-21 12:00:00', NULL),
    (3, 12, 2, 'Loud noise after midnight', 'A member keeps playing music after midnight.', 'dismissed', 'Could not verify the complaint.', '2026-10-12 23:30:00', '2026-10-15 11:00:00');

-- Notifications
INSERT INTO notifications (user_id, message, is_read, created_at) VALUES
    (2, 'Rafsan Jani is interested in Rahman Boys Mess.', 1, '2026-11-10 20:00:00'),
    (2, 'New comment on your post: Is the seat available from 1 December?', 1, '2026-11-11 19:00:00'),
    (2, 'Rafsan Jani requested a visit on 24 Nov, 6:30 pm.', 0, '2026-11-20 10:10:00'),
    (2, 'You have a new message from Mehedi Hasan.', 0, '2026-11-20 12:30:00'),
    (5, 'New comment on your post: Is wifi included in the rent?', 1, '2026-11-15 20:00:00'),
    (5, 'Tasnim Hossain requested a visit on 23 Nov, 5:00 pm.', 0, '2026-11-21 17:50:00'),
    (28, 'Your visit to Rahman Boys Mess is confirmed for 24 Nov, 6:30 pm.', 0, '2026-11-21 09:30:00'),
    (28, 'New message from Rahman Boys Mess.', 0, '2026-11-21 09:30:00'),
    (29, 'New message from Shanti Girls Mess.', 0, '2026-11-19 10:20:00'),
    (9, 'Your rent for November is overdue.', 0, '2026-11-11 08:00:00'),
    (13, 'You still have 1,750 BDT left to pay for November.', 0, '2026-11-13 08:00:00'),
    (26, 'Your rent for November is due on 25 Nov.', 0, '2026-11-18 12:05:00'),
    (8, 'Your complaint was marked as resolved.', 1, '2026-11-07 14:00:00'),
    (1, 'New mess waiting for verification: Badda Student Home.', 0, '2026-11-17 10:00:00'),
    (1, 'New complaint: Rent was higher than the post.', 0, '2026-11-18 16:00:00'),
    (7, 'Your mess is waiting for admin verification.', 1, '2026-11-17 10:05:00');
