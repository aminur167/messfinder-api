-- ====================================================================
-- Mess Finder database - Newsfeed and social (posts, comments, interests)
-- Tables: vacancy_posts, post_seats, seat_wanted_posts, post_comments, interests
-- Run the files in this folder in number order.
-- ====================================================================
USE mess_finder;

-- --------------------------------------------------------------------
-- vacancy_posts: Vacancy posts made by managers
-- --------------------------------------------------------------------
CREATE TABLE vacancy_posts (
    post_id        INT NOT NULL AUTO_INCREMENT,
    mess_id        INT NOT NULL,
    title          VARCHAR(150) NOT NULL,
    description    TEXT,
    available_from DATE NOT NULL,
    status         ENUM('open','closed','expired','removed') NOT NULL DEFAULT 'open',  -- removed = taken down by admin
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_vacancy_posts PRIMARY KEY (post_id),
    CONSTRAINT uq_post_mess UNIQUE (post_id, mess_id),  -- lets interests point at (post_id, mess_id)
    CONSTRAINT fk_vacancy_posts_mess FOREIGN KEY (mess_id)
        REFERENCES messes (mess_id)
        ON DELETE RESTRICT ON UPDATE NO ACTION
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'Vacancy posts made by managers';

-- --------------------------------------------------------------------
-- post_seats: Seats advertised in a vacancy post (many-to-many)
-- --------------------------------------------------------------------
CREATE TABLE post_seats (
    post_id INT NOT NULL,
    seat_id INT NOT NULL,

    CONSTRAINT pk_post_seats PRIMARY KEY (post_id, seat_id),
    CONSTRAINT fk_post_seats_post FOREIGN KEY (post_id)
        REFERENCES vacancy_posts (post_id)
        ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT fk_post_seats_seat FOREIGN KEY (seat_id)
        REFERENCES seats (seat_id)
        ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'Seats advertised in a vacancy post (many-to-many)';

-- --------------------------------------------------------------------
-- seat_wanted_posts: Seat wanted posts made by students
-- --------------------------------------------------------------------
CREATE TABLE seat_wanted_posts (
    wanted_id     INT NOT NULL AUTO_INCREMENT,
    student_id    INT NOT NULL,
    title         VARCHAR(150) NOT NULL,
    description   TEXT,
    area_id       INT,  -- preferred area
    university_id INT,
    budget_min    DECIMAL(10,2),
    budget_max    DECIMAL(10,2),
    mess_type     ENUM('boys','girls') NOT NULL,
    needed_from   DATE NOT NULL,
    status        ENUM('open','closed','expired','removed') NOT NULL DEFAULT 'open',  -- removed = taken down by admin
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_seat_wanted_posts PRIMARY KEY (wanted_id),
    CONSTRAINT fk_seat_wanted_posts_student FOREIGN KEY (student_id)
        REFERENCES student_profiles (student_id)
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT fk_seat_wanted_posts_area FOREIGN KEY (area_id)
        REFERENCES areas (area_id)
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT fk_seat_wanted_posts_university FOREIGN KEY (university_id)
        REFERENCES universities (university_id)
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT chk_budget CHECK (budget_min IS NULL OR budget_max IS NULL OR budget_min <= budget_max)  -- minimum budget cannot be above maximum
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'Seat wanted posts made by students';

-- --------------------------------------------------------------------
-- post_comments: Comments on newsfeed posts, either post type
-- --------------------------------------------------------------------
CREATE TABLE post_comments (
    comment_id      INT NOT NULL AUTO_INCREMENT,
    user_id         INT NOT NULL,  -- student or manager
    vacancy_post_id INT,
    wanted_post_id  INT,
    body            VARCHAR(500) NOT NULL,
    is_deleted      BOOLEAN NOT NULL DEFAULT 0,  -- 1 = soft delete
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_post_comments PRIMARY KEY (comment_id),
    KEY idx_post_comments_vacancy_post_id_created_at (vacancy_post_id, created_at),
    KEY idx_post_comments_wanted_post_id_created_at (wanted_post_id, created_at),
    CONSTRAINT fk_post_comments_user FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT fk_post_comments_vacancy_post FOREIGN KEY (vacancy_post_id)
        REFERENCES vacancy_posts (post_id)
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT fk_post_comments_wanted_post FOREIGN KEY (wanted_post_id)
        REFERENCES seat_wanted_posts (wanted_id)
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT chk_one_post CHECK ((vacancy_post_id IS NULL) <> (wanted_post_id IS NULL))  -- a comment belongs to exactly one post
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'Comments on newsfeed posts, either post type';

-- --------------------------------------------------------------------
-- interests: Messes a student marked as Interested
-- --------------------------------------------------------------------
CREATE TABLE interests (
    student_id INT NOT NULL,
    mess_id    INT NOT NULL,
    post_id    INT,  -- post the student pressed Interested on (optional)
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_interests PRIMARY KEY (student_id, mess_id),
    CONSTRAINT fk_interests_student FOREIGN KEY (student_id)
        REFERENCES student_profiles (student_id)
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT fk_interests_mess FOREIGN KEY (mess_id)
        REFERENCES messes (mess_id)
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT fk_interests_post FOREIGN KEY (post_id, mess_id)
        REFERENCES vacancy_posts (post_id, mess_id)
        ON DELETE RESTRICT ON UPDATE NO ACTION  -- post must belong to the same mess, skipped when post_id is NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'Messes a student marked as Interested';
