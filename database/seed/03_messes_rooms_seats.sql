-- ====================================================================
-- Mess Finder demo data - Messes, rooms and seats
-- Tables: messes, mess_facilities, mess_universities, rooms, seats, seat_rent_log
-- Seat status matches the members loaded in 05_members_dues_payments.sql.
-- Mess 6 is still pending admin approval, so it has no members or posts.
-- Run after the schema files. Load the seed files in number order.
-- ====================================================================
USE mess_finder;

-- Messes
INSERT INTO messes (mess_id, manager_id, area_id, mess_name, address, description, mess_type, rules, established_year, contact_phone, contact_whatsapp, has_meal, meal_cost_monthly, utility_included, advance_amount, latitude, longitude, status, created_at) VALUES
    (1, 2, 1, 'Rahman Boys Mess', 'House 12, Road 3, Section 10, Mirpur, Dhaka', 'A quiet mess for boys in Mirpur 10 with 24 hour water supply. Ten minutes by rickshaw from the Mirpur 10 metro station.', 'boys', 'No smoking inside. Gate closes at 11 pm. Guests are not allowed to stay overnight.', 2019, '8801811000002', '8801811000002', 0, NULL, 0, 3000, 23.8069, 90.3687, 'verified', '2026-01-10 10:00:00'),
    (2, 3, 2, 'Green Nest Mess', 'House 45, Road 8/A, Dhanmondi, Dhaka', 'Well kept mess in the heart of Dhanmondi, close to Daffodil and a short ride from BUET. Meals are served twice a day.', 'boys', 'Meal tokens must be collected before 9 am. No loud music after 10 pm. Guests only in the lobby.', 2016, '8801811000003', '8801811000003', 1, 2800, 1, 5000, 23.7461, 90.3742, 'verified', '2026-01-12 10:00:00'),
    (3, 4, 3, 'Shanti Girls Mess', 'House 7, Road 2, Block C, Mohammadpur, Dhaka', 'Safe girls mess in Mohammadpur with a security guard and CCTV. Home-style meals are included in the monthly cost.', 'girls', 'Gate closes at 10 pm. No male visitors beyond the lobby. Phones on silent after midnight.', 2020, '8801811000004', '8801811000004', 1, 2500, 0, 4000, 23.7662, 90.3586, 'verified', '2026-01-14 10:00:00'),
    (4, 5, 5, 'Campus Corner', 'Plot 18, Block D, Bashundhara R/A, Dhaka', 'Modern mess near North South University and Independent University with fast wifi and a rooftop to study or relax.', 'boys', 'No smoking. Quiet hours from 11 pm to 6 am. Rent is due by the 10th of every month.', 2021, '8801811000005', '8801811000005', 0, NULL, 1, 5000, 23.8121, 90.4268, 'verified', '2026-01-16 10:00:00'),
    (5, 6, 4, 'Sunrise Ladies Mess', 'House 22, Road 14, Sector 6, Uttara, Dhaka', 'Calm girls mess in Uttara sector 6 with a generator and three meals a day.', 'girls', 'Gate closes at 9:30 pm. Guests need prior approval. Please keep the common areas clean.', 2018, '8801811000006', '8801811000006', 1, 3000, 1, 4000, 23.8759, 90.3795, 'verified', '2026-01-18 10:00:00'),
    (6, 7, 6, 'Badda Student Home', 'House 9, Link Road, Badda, Dhaka', 'New mess in Badda for students of BRAC, UIU and EWU. Waiting for admin approval.', 'boys', 'Rules will be shared at the time of joining.', 2023, '8801811000007', '8801811000007', 0, NULL, 0, 3000, 23.7805, 90.426, 'pending', '2026-11-17 10:00:00');

-- Facilities of each mess
INSERT INTO mess_facilities (mess_id, facility_id) VALUES
    (1, 1),
    (1, 2),
    (1, 5),
    (1, 10),
    (2, 1),
    (2, 2),
    (2, 3),
    (2, 5),
    (2, 6),
    (2, 7),
    (2, 8),
    (3, 1),
    (3, 2),
    (3, 5),
    (3, 6),
    (3, 7),
    (4, 1),
    (4, 2),
    (4, 3),
    (4, 4),
    (4, 5),
    (4, 6),
    (4, 9),
    (4, 10),
    (5, 1),
    (5, 2),
    (5, 3),
    (5, 5),
    (5, 7),
    (5, 8),
    (6, 1),
    (6, 2),
    (6, 5);

-- Nearby universities with distance in km (approximate)
INSERT INTO mess_universities (mess_id, university_id, distance_km) VALUES
    (1, 1, 8.5),
    (1, 2, 9),
    (1, 4, 4.3),
    (2, 1, 2.5),
    (2, 2, 3.4),
    (2, 9, 0.8),
    (2, 5, 6.7),
    (3, 2, 5),
    (3, 1, 5.3),
    (3, 9, 2.9),
    (4, 3, 0.7),
    (4, 7, 0.9),
    (4, 6, 2.8),
    (4, 5, 4.2),
    (5, 8, 5.8),
    (5, 3, 7),
    (6, 4, 1.1),
    (6, 6, 3),
    (6, 5, 1.9);

-- Rooms
INSERT INTO rooms (room_id, mess_id, room_no, floor_no, has_attached_bath, has_balcony, is_active) VALUES
    (1, 1, '101', 1, 0, 0, 1),
    (2, 1, '102', 1, 0, 0, 1),
    (3, 1, '201', 2, 0, 1, 1),
    (4, 1, '202', 2, 1, 1, 1),
    (5, 2, '1A', 1, 1, 0, 1),
    (6, 2, '1B', 1, 0, 0, 1),
    (7, 2, '2A', 2, 0, 1, 1),
    (8, 2, '2B', 2, 0, 0, 1),
    (9, 3, '101', 1, 1, 0, 1),
    (10, 3, '102', 1, 0, 0, 1),
    (11, 3, '201', 2, 0, 1, 1),
    (12, 4, '101', 1, 0, 0, 1),
    (13, 4, '102', 1, 0, 0, 1),
    (14, 4, '201', 2, 1, 1, 1),
    (15, 4, '202', 2, 0, 1, 1),
    (16, 5, '101', 1, 1, 0, 1),
    (17, 5, '102', 1, 0, 0, 1),
    (18, 5, '201', 2, 0, 1, 1),
    (19, 6, '101', 1, 0, 0, 1),
    (20, 6, '102', 1, 0, 1, 1);

-- Seats (one seat in Green Nest room 2B is inactive)
INSERT INTO seats (seat_id, room_id, seat_label, monthly_rent, status) VALUES
    (1, 1, 'A', 3000, 'booked'),
    (2, 1, 'B', 3000, 'booked'),
    (3, 1, 'C', 3200, 'booked'),
    (4, 2, 'A', 3500, 'booked'),
    (5, 2, 'B', 3500, 'available'),
    (6, 3, 'A', 3800, 'booked'),
    (7, 3, 'B', 3800, 'available'),
    (8, 3, 'C', 3800, 'available'),
    (9, 4, 'A', 4200, 'available'),
    (10, 4, 'B', 4200, 'available'),
    (11, 5, 'A', 5000, 'booked'),
    (12, 5, 'B', 5000, 'booked'),
    (13, 6, 'A', 4500, 'booked'),
    (14, 6, 'B', 4500, 'booked'),
    (15, 6, 'C', 4500, 'available'),
    (16, 7, 'A', 5500, 'booked'),
    (17, 7, 'B', 5500, 'booked'),
    (18, 7, 'C', 5500, 'available'),
    (19, 8, 'A', 4800, 'available'),
    (20, 8, 'B', 4800, 'inactive'),
    (21, 9, 'A', 4200, 'booked'),
    (22, 9, 'B', 4200, 'booked'),
    (23, 9, 'C', 4200, 'available'),
    (24, 10, 'A', 3800, 'booked'),
    (25, 10, 'B', 3800, 'booked'),
    (26, 10, 'C', 3800, 'available'),
    (27, 11, 'A', 3500, 'booked'),
    (28, 11, 'B', 3500, 'available'),
    (29, 12, 'A', 4500, 'booked'),
    (30, 12, 'B', 4500, 'booked'),
    (31, 12, 'C', 4500, 'available'),
    (32, 13, 'A', 4200, 'booked'),
    (33, 13, 'B', 4200, 'booked'),
    (34, 13, 'C', 4200, 'booked'),
    (35, 14, 'A', 5000, 'booked'),
    (36, 14, 'B', 5000, 'available'),
    (37, 15, 'A', 4800, 'available'),
    (38, 15, 'B', 4800, 'available'),
    (39, 16, 'A', 4500, 'booked'),
    (40, 16, 'B', 4500, 'booked'),
    (41, 17, 'A', 4000, 'booked'),
    (42, 17, 'B', 4000, 'available'),
    (43, 17, 'C', 4000, 'available'),
    (44, 18, 'A', 4200, 'available'),
    (45, 18, 'B', 4200, 'available'),
    (46, 19, 'A', 3600, 'available'),
    (47, 19, 'B', 3600, 'available'),
    (48, 19, 'C', 3600, 'available'),
    (49, 20, 'A', 3900, 'available'),
    (50, 20, 'B', 3900, 'available');

-- Rent changes (old members keep the rent they joined with)
INSERT INTO seat_rent_log (seat_id, old_rent, new_rent, changed_at) VALUES
    (3, 3000, 3200, '2026-10-05 09:00:00'),
    (6, 3600, 3800, '2026-08-01 09:00:00'),
    (11, 4800, 5000, '2026-06-15 09:00:00'),
    (35, 4800, 5000, '2026-09-10 09:00:00');
