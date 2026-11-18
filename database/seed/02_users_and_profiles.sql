-- ====================================================================
-- Mess Finder demo data - Users and profiles
-- Tables: users, student_profiles, manager_profiles
-- Every demo account uses the same password, see database/README.md.
-- Admin: id 1. Managers: ids 2-7. Students: ids 8-31 (id 31 is blocked).
-- Run after the schema files. Load the seed files in number order.
-- ====================================================================
USE mess_finder;

-- All accounts
INSERT INTO users (user_id, full_name, email, phone, password_hash, role, is_active, created_at) VALUES
    (1, 'System Admin', 'admin@example.com', '01900000001', '$2b$10$TUKKVe1KQ7BagaV0/zcD8Om4vnu/c6CoUq..GlBrc9sWKrRHSJ9CC', 'admin', 1, '2026-01-01 09:00:00'),
    (2, 'Abdur Rahman', 'abdur.rahman@example.com', '01811000002', '$2b$10$TUKKVe1KQ7BagaV0/zcD8Om4vnu/c6CoUq..GlBrc9sWKrRHSJ9CC', 'manager', 1, '2026-01-04 10:00:00'),
    (3, 'Kamal Hossain', 'kamal.hossain@example.com', '01811000003', '$2b$10$TUKKVe1KQ7BagaV0/zcD8Om4vnu/c6CoUq..GlBrc9sWKrRHSJ9CC', 'manager', 1, '2026-01-05 10:00:00'),
    (4, 'Shirin Akter', 'shirin.akter@example.com', '01811000004', '$2b$10$TUKKVe1KQ7BagaV0/zcD8Om4vnu/c6CoUq..GlBrc9sWKrRHSJ9CC', 'manager', 1, '2026-01-06 10:00:00'),
    (5, 'Jahid Hasan', 'jahid.hasan@example.com', '01811000005', '$2b$10$TUKKVe1KQ7BagaV0/zcD8Om4vnu/c6CoUq..GlBrc9sWKrRHSJ9CC', 'manager', 1, '2026-01-07 10:00:00'),
    (6, 'Nasrin Sultana', 'nasrin.sultana@example.com', '01811000006', '$2b$10$TUKKVe1KQ7BagaV0/zcD8Om4vnu/c6CoUq..GlBrc9sWKrRHSJ9CC', 'manager', 1, '2026-01-08 10:00:00'),
    (7, 'Mizanur Rahman', 'mizanur.rahman@example.com', '01811000007', '$2b$10$TUKKVe1KQ7BagaV0/zcD8Om4vnu/c6CoUq..GlBrc9sWKrRHSJ9CC', 'manager', 1, '2026-01-09 10:00:00'),
    (8, 'Rafiul Islam', 'rafiul.islam@example.com', '01711000008', '$2b$10$TUKKVe1KQ7BagaV0/zcD8Om4vnu/c6CoUq..GlBrc9sWKrRHSJ9CC', 'student', 1, '2026-09-13 11:00:00'),
    (9, 'Sumon Ahmed', 'sumon.ahmed@example.com', '01711000009', '$2b$10$TUKKVe1KQ7BagaV0/zcD8Om4vnu/c6CoUq..GlBrc9sWKrRHSJ9CC', 'student', 1, '2026-01-14 11:00:00'),
    (10, 'Tanvir Hasan', 'tanvir.hasan@example.com', '01711000010', '$2b$10$TUKKVe1KQ7BagaV0/zcD8Om4vnu/c6CoUq..GlBrc9sWKrRHSJ9CC', 'student', 1, '2026-02-15 11:00:00'),
    (11, 'Imran Hossain', 'imran.hossain@example.com', '01711000011', '$2b$10$TUKKVe1KQ7BagaV0/zcD8Om4vnu/c6CoUq..GlBrc9sWKrRHSJ9CC', 'student', 1, '2026-03-16 11:00:00'),
    (12, 'Faisal Karim', 'faisal.karim@example.com', '01711000012', '$2b$10$TUKKVe1KQ7BagaV0/zcD8Om4vnu/c6CoUq..GlBrc9sWKrRHSJ9CC', 'student', 1, '2026-04-17 11:00:00'),
    (13, 'Nayeem Uddin', 'nayeem.uddin@example.com', '01711000013', '$2b$10$TUKKVe1KQ7BagaV0/zcD8Om4vnu/c6CoUq..GlBrc9sWKrRHSJ9CC', 'student', 1, '2026-05-18 11:00:00'),
    (14, 'Arif Mahmud', 'arif.mahmud@example.com', '01711000014', '$2b$10$TUKKVe1KQ7BagaV0/zcD8Om4vnu/c6CoUq..GlBrc9sWKrRHSJ9CC', 'student', 1, '2026-06-19 11:00:00'),
    (15, 'Shakib Rahman', 'shakib.rahman@example.com', '01711000015', '$2b$10$TUKKVe1KQ7BagaV0/zcD8Om4vnu/c6CoUq..GlBrc9sWKrRHSJ9CC', 'student', 1, '2026-07-20 11:00:00'),
    (16, 'Mehedi Hasan', 'mehedi.hasan@example.com', '01711000016', '$2b$10$TUKKVe1KQ7BagaV0/zcD8Om4vnu/c6CoUq..GlBrc9sWKrRHSJ9CC', 'student', 1, '2026-08-21 11:00:00'),
    (17, 'Rakib Hossain', 'rakib.hossain@example.com', '01711000017', '$2b$10$TUKKVe1KQ7BagaV0/zcD8Om4vnu/c6CoUq..GlBrc9sWKrRHSJ9CC', 'student', 1, '2026-09-22 11:00:00'),
    (18, 'Sabbir Ahmed', 'sabbir.ahmed@example.com', '01711000018', '$2b$10$TUKKVe1KQ7BagaV0/zcD8Om4vnu/c6CoUq..GlBrc9sWKrRHSJ9CC', 'student', 1, '2026-01-23 11:00:00'),
    (19, 'Zahid Hasan', 'zahid.hasan@example.com', '01711000019', '$2b$10$TUKKVe1KQ7BagaV0/zcD8Om4vnu/c6CoUq..GlBrc9sWKrRHSJ9CC', 'student', 1, '2026-02-24 11:00:00'),
    (20, 'Habib Khan', 'habib.khan@example.com', '01711000020', '$2b$10$TUKKVe1KQ7BagaV0/zcD8Om4vnu/c6CoUq..GlBrc9sWKrRHSJ9CC', 'student', 1, '2026-03-05 11:00:00'),
    (21, 'Ashik Mia', 'ashik.mia@example.com', '01711000021', '$2b$10$TUKKVe1KQ7BagaV0/zcD8Om4vnu/c6CoUq..GlBrc9sWKrRHSJ9CC', 'student', 1, '2026-04-06 11:00:00'),
    (22, 'Nila Akter', 'nila.akter@example.com', '01711000022', '$2b$10$TUKKVe1KQ7BagaV0/zcD8Om4vnu/c6CoUq..GlBrc9sWKrRHSJ9CC', 'student', 1, '2026-05-07 11:00:00'),
    (23, 'Tania Rahman', 'tania.rahman@example.com', '01711000023', '$2b$10$TUKKVe1KQ7BagaV0/zcD8Om4vnu/c6CoUq..GlBrc9sWKrRHSJ9CC', 'student', 1, '2026-06-08 11:00:00'),
    (24, 'Mim Sultana', 'mim.sultana@example.com', '01711000024', '$2b$10$TUKKVe1KQ7BagaV0/zcD8Om4vnu/c6CoUq..GlBrc9sWKrRHSJ9CC', 'student', 1, '2026-07-09 11:00:00'),
    (25, 'Farhana Yeasmin', 'farhana.yeasmin@example.com', '01711000025', '$2b$10$TUKKVe1KQ7BagaV0/zcD8Om4vnu/c6CoUq..GlBrc9sWKrRHSJ9CC', 'student', 1, '2026-08-10 11:00:00'),
    (26, 'Sadia Islam', 'sadia.islam@example.com', '01711000026', '$2b$10$TUKKVe1KQ7BagaV0/zcD8Om4vnu/c6CoUq..GlBrc9sWKrRHSJ9CC', 'student', 1, '2026-09-11 11:00:00'),
    (27, 'Lamia Chowdhury', 'lamia.chowdhury@example.com', '01711000027', '$2b$10$TUKKVe1KQ7BagaV0/zcD8Om4vnu/c6CoUq..GlBrc9sWKrRHSJ9CC', 'student', 1, '2026-01-12 11:00:00'),
    (28, 'Rafsan Jani', 'rafsan.jani@example.com', '01711000028', '$2b$10$TUKKVe1KQ7BagaV0/zcD8Om4vnu/c6CoUq..GlBrc9sWKrRHSJ9CC', 'student', 1, '2026-02-13 11:00:00'),
    (29, 'Anika Tabassum', 'anika.tabassum@example.com', '01711000029', '$2b$10$TUKKVe1KQ7BagaV0/zcD8Om4vnu/c6CoUq..GlBrc9sWKrRHSJ9CC', 'student', 1, '2026-03-14 11:00:00'),
    (30, 'Tasnim Hossain', 'tasnim.hossain@example.com', '01711000030', '$2b$10$TUKKVe1KQ7BagaV0/zcD8Om4vnu/c6CoUq..GlBrc9sWKrRHSJ9CC', 'student', 1, '2026-04-15 11:00:00'),
    (31, 'Kabir Hossain', 'kabir.hossain@example.com', '01711000031', '$2b$10$TUKKVe1KQ7BagaV0/zcD8Om4vnu/c6CoUq..GlBrc9sWKrRHSJ9CC', 'student', 0, '2026-05-16 11:00:00');

-- Student details (student_id is the same number as user_id)
INSERT INTO student_profiles (student_id, university_id, student_roll, department, gender) VALUES
    (8, 1, '2105031', 'CSE', 'male'),
    (9, 2, '21-03-114', 'Economics', 'male'),
    (10, 3, '2121456642', 'BBA', 'male'),
    (11, 4, '21101234', 'CSE', 'male'),
    (12, 5, '2021-1-60-045', 'EEE', 'male'),
    (13, 6, '011211023', 'CSE', 'male'),
    (14, 7, '2120098', 'BBA', 'male'),
    (15, 8, '21-44912-1', 'CSE', 'male'),
    (16, 2, '20-04-088', 'Law', 'male'),
    (17, 1, '2106077', 'EEE', 'male'),
    (18, 3, '2031290642', 'CSE', 'male'),
    (19, 9, '212-35-3055', 'SWE', 'male'),
    (20, 4, '20201188', 'Architecture', 'male'),
    (21, 5, '2022-1-70-019', 'Pharmacy', 'male'),
    (22, 2, '21-02-051', 'English', 'female'),
    (23, 3, '2111899642', 'BBA', 'female'),
    (24, 4, '21301456', 'CSE', 'female'),
    (25, 5, '2021-1-10-073', 'Economics', 'female'),
    (26, 6, '111221087', 'BBA', 'female'),
    (27, 2, '21-05-132', 'Sociology', 'female'),
    (28, 2, '22-03-210', 'Political Science', 'male'),
    (29, 4, '22201345', 'CSE', 'female'),
    (30, 3, '2211678642', 'BBA', 'male'),
    (31, 6, '011221040', 'EEE', 'male');

-- Manager details
INSERT INTO manager_profiles (manager_id, nid_no, address, is_verified) VALUES
    (2, '19780412345678901', 'House 12, Road 3, Section 10, Mirpur, Dhaka', 1),
    (3, '19750830123456789', 'House 45, Road 8/A, Dhanmondi, Dhaka', 1),
    (4, '19820219876543210', 'House 7, Road 2, Block C, Mohammadpur, Dhaka', 1),
    (5, '19880705543210987', 'Plot 18, Block D, Bashundhara R/A, Dhaka', 1),
    (6, '19800926112233445', 'House 22, Road 14, Sector 6, Uttara, Dhaka', 1),
    (7, '19860314998877665', 'House 9, Link Road, Badda, Dhaka', 0);
