-- ====================================================================
-- Mess Finder database - Complaints and notifications
-- Tables: complaints, notifications
-- Run the files in this folder in number order.
-- ====================================================================
USE mess_finder;

-- --------------------------------------------------------------------
-- complaints: Complaints filed by users
-- --------------------------------------------------------------------
CREATE TABLE complaints (
    complaint_id    INT NOT NULL AUTO_INCREMENT,
    complainant_id  INT NOT NULL,  -- who filed it
    against_user_id INT,
    mess_id         INT,
    subject         VARCHAR(150) NOT NULL,
    description     TEXT NOT NULL,
    status          ENUM('open','in_review','resolved','dismissed') NOT NULL DEFAULT 'open',
    admin_note      VARCHAR(255),
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at     TIMESTAMP,

    CONSTRAINT pk_complaints PRIMARY KEY (complaint_id),
    CONSTRAINT fk_complaints_complainant FOREIGN KEY (complainant_id)
        REFERENCES users (user_id)
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT fk_complaints_against_user FOREIGN KEY (against_user_id)
        REFERENCES users (user_id)
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT fk_complaints_mess FOREIGN KEY (mess_id)
        REFERENCES messes (mess_id)
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT chk_comp_target CHECK (against_user_id IS NOT NULL OR mess_id IS NOT NULL),  -- a complaint is about a user or a mess
    CONSTRAINT chk_comp_self CHECK (against_user_id IS NULL OR against_user_id <> complainant_id),  -- cannot complain about yourself
    CONSTRAINT chk_comp_resolved CHECK ((status IN ('resolved','dismissed')) = (resolved_at IS NOT NULL))  -- resolved_at only for resolved or dismissed complaints
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'Complaints filed by users';

-- --------------------------------------------------------------------
-- notifications: Notifications shown to users
-- --------------------------------------------------------------------
CREATE TABLE notifications (
    notification_id INT NOT NULL AUTO_INCREMENT,
    user_id         INT NOT NULL,
    message         VARCHAR(255) NOT NULL,
    is_read         BOOLEAN NOT NULL DEFAULT 0,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_notifications PRIMARY KEY (notification_id),
    KEY idx_notifications_user_id_is_read_created_at (user_id, is_read, created_at),
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON DELETE RESTRICT ON UPDATE NO ACTION
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'Notifications shown to users';
