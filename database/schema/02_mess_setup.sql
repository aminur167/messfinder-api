-- ====================================================================
-- Mess Finder database - Mess setup (mess, facilities, rooms, seats)
-- Tables: messes, facilities, mess_facilities, mess_universities, rooms, seats, seat_rent_log
-- Run the files in this folder in number order.
-- ====================================================================
USE mess_finder;

-- --------------------------------------------------------------------
-- messes: Mess details, one mess per manager
-- --------------------------------------------------------------------
CREATE TABLE messes (
    mess_id           INT NOT NULL AUTO_INCREMENT,
    manager_id        INT NOT NULL,  -- UNIQUE: one manager runs one mess
    area_id           INT NOT NULL,
    mess_name         VARCHAR(120) NOT NULL,
    address           VARCHAR(255) NOT NULL,
    description       TEXT,
    mess_type         ENUM('boys','girls') NOT NULL,
    rules             TEXT,
    established_year  YEAR,
    contact_phone     VARCHAR(20) NOT NULL,  -- with country code, e.g. 8801711000000
    contact_whatsapp  VARCHAR(20),
    has_meal          BOOLEAN NOT NULL DEFAULT 0,
    meal_cost_monthly DECIMAL(10,2),
    utility_included  BOOLEAN NOT NULL DEFAULT 0,
    advance_amount    DECIMAL(10,2) NOT NULL DEFAULT 0,
    latitude          DECIMAL(9,6) NOT NULL,
    longitude         DECIMAL(9,6) NOT NULL,
    status            ENUM('pending','verified','suspended','closed') NOT NULL DEFAULT 'pending',  -- closed = soft delete
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_messes PRIMARY KEY (mess_id),
    CONSTRAINT uq_messes_manager UNIQUE (manager_id),  -- one manager, one mess
    FULLTEXT KEY ftx_messes_description (description),
    KEY idx_messes_area_id_mess_type_status (area_id, mess_type, status),
    CONSTRAINT fk_messes_manager FOREIGN KEY (manager_id)
        REFERENCES manager_profiles (manager_id)
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT fk_messes_area FOREIGN KEY (area_id)
        REFERENCES areas (area_id)
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT chk_mess_meal CHECK (has_meal = 1 OR meal_cost_monthly IS NULL),  -- meal cost only if the mess serves meals
    CONSTRAINT chk_mess_meal_cost CHECK (meal_cost_monthly IS NULL OR meal_cost_monthly >= 0),  -- meal cost cannot be negative
    CONSTRAINT chk_mess_advance CHECK (advance_amount >= 0),  -- advance cannot be negative
    CONSTRAINT chk_mess_lat CHECK (latitude BETWEEN -90 AND 90),  -- valid latitude
    CONSTRAINT chk_mess_lng CHECK (longitude BETWEEN -180 AND 180)  -- valid longitude
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'Mess details, one mess per manager';

-- --------------------------------------------------------------------
-- facilities: Facility list: wifi, gas, generator...
-- --------------------------------------------------------------------
CREATE TABLE facilities (
    facility_id   INT NOT NULL AUTO_INCREMENT,
    facility_name VARCHAR(50) NOT NULL,

    CONSTRAINT pk_facilities PRIMARY KEY (facility_id),
    CONSTRAINT uq_facilities_facility_name UNIQUE (facility_name)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'Facility list: wifi, gas, generator...';

-- --------------------------------------------------------------------
-- mess_facilities: Facilities a mess has (many-to-many)
-- --------------------------------------------------------------------
CREATE TABLE mess_facilities (
    mess_id     INT NOT NULL,
    facility_id INT NOT NULL,

    CONSTRAINT pk_mess_facilities PRIMARY KEY (mess_id, facility_id),
    CONSTRAINT fk_mess_facilities_mess FOREIGN KEY (mess_id)
        REFERENCES messes (mess_id)
        ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT fk_mess_facilities_facility FOREIGN KEY (facility_id)
        REFERENCES facilities (facility_id)
        ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'Facilities a mess has (many-to-many)';

-- --------------------------------------------------------------------
-- mess_universities: Nearby universities of a mess with distance (many-to-many)
-- --------------------------------------------------------------------
CREATE TABLE mess_universities (
    mess_id       INT NOT NULL,
    university_id INT NOT NULL,
    distance_km   DECIMAL(4,1) NOT NULL,

    CONSTRAINT pk_mess_universities PRIMARY KEY (mess_id, university_id),
    CONSTRAINT fk_mess_universities_mess FOREIGN KEY (mess_id)
        REFERENCES messes (mess_id)
        ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT fk_mess_universities_university FOREIGN KEY (university_id)
        REFERENCES universities (university_id)
        ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT chk_mu_dist CHECK (distance_km >= 0)  -- distance cannot be negative
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'Nearby universities of a mess with distance (many-to-many)';

-- --------------------------------------------------------------------
-- rooms: Rooms inside a mess
-- --------------------------------------------------------------------
CREATE TABLE rooms (
    room_id           INT NOT NULL AUTO_INCREMENT,
    mess_id           INT NOT NULL,
    room_no           VARCHAR(10) NOT NULL,
    floor_no          TINYINT,
    has_attached_bath BOOLEAN NOT NULL DEFAULT 0,
    has_balcony       BOOLEAN NOT NULL DEFAULT 0,
    is_active         BOOLEAN NOT NULL DEFAULT 1,  -- 0 = soft delete

    CONSTRAINT pk_rooms PRIMARY KEY (room_id),
    CONSTRAINT uq_room_no UNIQUE (mess_id, room_no),  -- no duplicate room number inside one mess
    CONSTRAINT fk_rooms_mess FOREIGN KEY (mess_id)
        REFERENCES messes (mess_id)
        ON DELETE RESTRICT ON UPDATE NO ACTION
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'Rooms inside a mess';

-- --------------------------------------------------------------------
-- seats: Seats inside a room, rent is set per seat
-- --------------------------------------------------------------------
CREATE TABLE seats (
    seat_id      INT NOT NULL AUTO_INCREMENT,
    room_id      INT NOT NULL,
    seat_label   VARCHAR(10) NOT NULL,
    monthly_rent DECIMAL(10,2) NOT NULL,
    status       ENUM('available','booked','inactive') NOT NULL DEFAULT 'available',  -- inactive = soft delete

    CONSTRAINT pk_seats PRIMARY KEY (seat_id),
    CONSTRAINT uq_seat_label UNIQUE (room_id, seat_label),  -- no duplicate seat label inside one room
    CONSTRAINT fk_seats_room FOREIGN KEY (room_id)
        REFERENCES rooms (room_id)
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT chk_seat_rent CHECK (monthly_rent > 0)  -- rent must be positive
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'Seats inside a room, rent is set per seat';

-- --------------------------------------------------------------------
-- seat_rent_log: History of seat rent changes (filled by a trigger)
-- --------------------------------------------------------------------
CREATE TABLE seat_rent_log (
    log_id     INT NOT NULL AUTO_INCREMENT,
    seat_id    INT NOT NULL,
    old_rent   DECIMAL(10,2) NOT NULL,
    new_rent   DECIMAL(10,2) NOT NULL,
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_seat_rent_log PRIMARY KEY (log_id),
    CONSTRAINT fk_seat_rent_log_seat FOREIGN KEY (seat_id)
        REFERENCES seats (seat_id)
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT chk_log_diff CHECK (old_rent <> new_rent)  -- old and new rent must differ
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'History of seat rent changes (filled by a trigger)';
