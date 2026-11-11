-- ====================================================================
-- Mess Finder database - Users and locations
-- Tables: areas, universities, users, student_profiles, manager_profiles
-- Run the files in this folder in number order.
-- ====================================================================
USE mess_finder;

-- --------------------------------------------------------------------
-- areas: Areas of the city, used to filter messes
-- --------------------------------------------------------------------
CREATE TABLE areas (
    area_id   INT NOT NULL AUTO_INCREMENT,
    area_name VARCHAR(80) NOT NULL,
    city      VARCHAR(50) NOT NULL DEFAULT 'Dhaka',

    CONSTRAINT pk_areas PRIMARY KEY (area_id),
    CONSTRAINT uq_areas_area_name UNIQUE (area_name)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'Areas of the city, used to filter messes';

-- --------------------------------------------------------------------
-- universities: Universities with coordinates for the nearby search
-- --------------------------------------------------------------------
CREATE TABLE universities (
    university_id INT NOT NULL AUTO_INCREMENT,
    name          VARCHAR(150) NOT NULL,
    short_name    VARCHAR(20),
    area_id       INT NOT NULL,
    latitude      DECIMAL(9,6) NOT NULL,
    longitude     DECIMAL(9,6) NOT NULL,

    CONSTRAINT pk_universities PRIMARY KEY (university_id),
    CONSTRAINT uq_universities_name UNIQUE (name),
    CONSTRAINT fk_universities_area FOREIGN KEY (area_id)
        REFERENCES areas (area_id)
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT chk_uni_lat CHECK (latitude BETWEEN -90 AND 90),  -- valid latitude
    CONSTRAINT chk_uni_lng CHECK (longitude BETWEEN -180 AND 180)  -- valid longitude
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'Universities with coordinates for the nearby search';

-- --------------------------------------------------------------------
-- users: All accounts: student, manager and admin
-- --------------------------------------------------------------------
CREATE TABLE users (
    user_id       INT NOT NULL AUTO_INCREMENT,
    full_name     VARCHAR(100) NOT NULL,
    email         VARCHAR(120) NOT NULL,
    phone         VARCHAR(20) NOT NULL,  -- unique, managers search students by phone
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('student','manager','admin') NOT NULL,
    is_active     BOOLEAN NOT NULL DEFAULT 1,  -- 0 = blocked (soft delete)
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_users PRIMARY KEY (user_id),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT uq_users_phone UNIQUE (phone),
    CONSTRAINT uq_user_role UNIQUE (user_id, role)  -- lets profile tables point at (user_id, role)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'All accounts: student, manager and admin';

-- --------------------------------------------------------------------
-- student_profiles: Extra details for student accounts (1:1 with users)
-- --------------------------------------------------------------------
CREATE TABLE student_profiles (
    student_id    INT NOT NULL,
    role          ENUM('student','manager','admin') NOT NULL DEFAULT 'student',  -- always 'student'
    university_id INT NOT NULL,
    student_roll  VARCHAR(30),
    department    VARCHAR(80),
    gender        ENUM('male','female') NOT NULL,

    CONSTRAINT pk_student_profiles PRIMARY KEY (student_id),
    CONSTRAINT fk_student_profiles_user FOREIGN KEY (student_id, role)
        REFERENCES users (user_id, role)
        ON DELETE RESTRICT ON UPDATE NO ACTION,  -- a manager account cannot get a student profile
    CONSTRAINT fk_student_profiles_university FOREIGN KEY (university_id)
        REFERENCES universities (university_id)
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT chk_sp_role CHECK (role = 'student')  -- role is always 'student'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'Extra details for student accounts (1:1 with users)';

-- --------------------------------------------------------------------
-- manager_profiles: Extra details for manager accounts (1:1 with users)
-- --------------------------------------------------------------------
CREATE TABLE manager_profiles (
    manager_id  INT NOT NULL,
    role        ENUM('student','manager','admin') NOT NULL DEFAULT 'manager',  -- always 'manager'
    nid_no      VARCHAR(20) NOT NULL,
    address     VARCHAR(255),
    is_verified BOOLEAN NOT NULL DEFAULT 0,  -- admin verifies managers

    CONSTRAINT pk_manager_profiles PRIMARY KEY (manager_id),
    CONSTRAINT uq_manager_profiles_nid_no UNIQUE (nid_no),
    CONSTRAINT fk_manager_profiles_user FOREIGN KEY (manager_id, role)
        REFERENCES users (user_id, role)
        ON DELETE RESTRICT ON UPDATE NO ACTION,  -- a student account cannot get a manager profile
    CONSTRAINT chk_mp_role CHECK (role = 'manager')  -- role is always 'manager'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'Extra details for manager accounts (1:1 with users)';
