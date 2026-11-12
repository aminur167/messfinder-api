-- ====================================================================
-- Mess Finder database - Reviews, visit requests and chat
-- Tables: reviews, visit_requests, conversations, messages
-- Run the files in this folder in number order.
-- ====================================================================
USE mess_finder;

-- --------------------------------------------------------------------
-- reviews: Reviews by current or ex members, with manager reply
-- --------------------------------------------------------------------
CREATE TABLE reviews (
    review_id          INT NOT NULL AUTO_INCREMENT,
    mess_id            INT NOT NULL,
    student_id         INT NOT NULL,
    rating             TINYINT NOT NULL,  -- overall rating
    cleanliness_rating TINYINT,
    safety_rating      TINYINT,
    food_rating        TINYINT,
    comment            VARCHAR(500),
    manager_reply      VARCHAR(500),
    replied_at         TIMESTAMP,
    created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_reviews PRIMARY KEY (review_id),
    CONSTRAINT uq_review UNIQUE (mess_id, student_id),  -- one review per student per mess
    CONSTRAINT fk_reviews_mess FOREIGN KEY (mess_id)
        REFERENCES messes (mess_id)
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT fk_reviews_student FOREIGN KEY (student_id)
        REFERENCES student_profiles (student_id)
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT chk_rating CHECK (rating BETWEEN 1 AND 5),  -- rating from 1 to 5
    CONSTRAINT chk_rating_clean CHECK (cleanliness_rating IS NULL OR cleanliness_rating BETWEEN 1 AND 5),  -- rating from 1 to 5
    CONSTRAINT chk_rating_safe CHECK (safety_rating IS NULL OR safety_rating BETWEEN 1 AND 5),  -- rating from 1 to 5
    CONSTRAINT chk_rating_food CHECK (food_rating IS NULL OR food_rating BETWEEN 1 AND 5),  -- rating from 1 to 5
    CONSTRAINT chk_reply_pair CHECK ((manager_reply IS NULL) = (replied_at IS NULL))  -- reply text and reply time go together
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'Reviews by current or ex members, with manager reply';

-- --------------------------------------------------------------------
-- visit_requests: Requests from students to visit a mess
-- --------------------------------------------------------------------
CREATE TABLE visit_requests (
    visit_id     INT NOT NULL AUTO_INCREMENT,
    student_id   INT NOT NULL,
    mess_id      INT NOT NULL,
    visit_time   DATETIME NOT NULL,
    status       ENUM('pending','confirmed','rejected','cancelled','completed') NOT NULL DEFAULT 'pending',
    student_note VARCHAR(255),
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_visit_requests PRIMARY KEY (visit_id),
    CONSTRAINT fk_visit_requests_student FOREIGN KEY (student_id)
        REFERENCES student_profiles (student_id)
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT fk_visit_requests_mess FOREIGN KEY (mess_id)
        REFERENCES messes (mess_id)
        ON DELETE RESTRICT ON UPDATE NO ACTION
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'Requests from students to visit a mess';

-- --------------------------------------------------------------------
-- conversations: One chat thread per student and mess
-- --------------------------------------------------------------------
CREATE TABLE conversations (
    conversation_id INT NOT NULL AUTO_INCREMENT,
    mess_id         INT NOT NULL,
    student_id      INT NOT NULL,
    last_message_at TIMESTAMP,  -- kept up to date by a trigger
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_conversations PRIMARY KEY (conversation_id),
    CONSTRAINT uq_conversation UNIQUE (mess_id, student_id),  -- one chat thread per student per mess
    CONSTRAINT fk_conversations_mess FOREIGN KEY (mess_id)
        REFERENCES messes (mess_id)
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT fk_conversations_student FOREIGN KEY (student_id)
        REFERENCES student_profiles (student_id)
        ON DELETE RESTRICT ON UPDATE NO ACTION
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'One chat thread per student and mess';

-- --------------------------------------------------------------------
-- messages: Chat messages
-- --------------------------------------------------------------------
CREATE TABLE messages (
    message_id      INT NOT NULL AUTO_INCREMENT,
    conversation_id INT NOT NULL,
    sender_id       INT NOT NULL,
    body            VARCHAR(1000) NOT NULL,
    is_read         BOOLEAN NOT NULL DEFAULT 0,
    sent_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_messages PRIMARY KEY (message_id),
    KEY idx_messages_conversation_id_sent_at (conversation_id, sent_at),
    CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id)
        REFERENCES conversations (conversation_id)
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id)
        REFERENCES users (user_id)
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT chk_msg_body CHECK (CHAR_LENGTH(TRIM(body)) > 0)  -- no empty messages
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'Chat messages';
