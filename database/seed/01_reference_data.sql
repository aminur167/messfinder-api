-- ====================================================================
-- Mess Finder demo data - Reference data
-- Tables: areas, universities, facilities
-- University coordinates are approximate, good enough for the nearby search demo.
-- Run after the schema files. Load the seed files in number order.
-- ====================================================================
USE mess_finder;

-- Areas
INSERT INTO areas (area_id, area_name) VALUES
    (1, 'Mirpur'),
    (2, 'Dhanmondi'),
    (3, 'Mohammadpur'),
    (4, 'Uttara'),
    (5, 'Bashundhara'),
    (6, 'Badda'),
    (7, 'Farmgate'),
    (8, 'Shahbag'),
    (9, 'Aftabnagar');

-- Universities
INSERT INTO universities (university_id, name, short_name, area_id, latitude, longitude) VALUES
    (1, 'Bangladesh University of Engineering and Technology', 'BUET', 8, 23.7265, 90.3926),
    (2, 'University of Dhaka', 'DU', 8, 23.7336, 90.3925),
    (3, 'North South University', 'NSU', 5, 23.815, 90.4252),
    (4, 'BRAC University', 'BracU', 6, 23.7806, 90.4075),
    (5, 'East West University', 'EWU', 9, 23.7689, 90.4258),
    (6, 'United International University', 'UIU', 6, 23.8045, 90.4219),
    (7, 'Independent University, Bangladesh', 'IUB', 5, 23.8138, 90.4243),
    (8, 'American International University-Bangladesh', 'AIUB', 4, 23.828, 90.419),
    (9, 'Daffodil International University', 'DIU', 2, 23.751, 90.3735);

-- Facilities
INSERT INTO facilities (facility_id, facility_name) VALUES
    (1, 'WiFi'),
    (2, 'Gas supply'),
    (3, 'Generator backup'),
    (4, 'Lift'),
    (5, 'Filtered water'),
    (6, 'CCTV'),
    (7, 'Security guard'),
    (8, 'Washing machine'),
    (9, 'Rooftop access'),
    (10, 'Study table');
