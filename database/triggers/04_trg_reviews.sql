-- ====================================================================
-- Triggers of reviews
--
-- BEFORE INSERT: only a person who lived in the mess (current or ex member
--                with a linked account) can write a review for it.
-- AFTER INSERT:  the manager gets a notification.
-- ====================================================================
USE mess_finder;

DROP TRIGGER IF EXISTS trg_reviews_before_insert;
DROP TRIGGER IF EXISTS trg_reviews_after_insert;

DELIMITER $$

CREATE TRIGGER trg_reviews_before_insert
BEFORE INSERT ON reviews
FOR EACH ROW
BEGIN
    IF NOT EXISTS (SELECT 1
                     FROM mess_members AS m
                     JOIN seats AS s ON s.seat_id = m.seat_id
                     JOIN rooms AS r ON r.room_id = s.room_id
                    WHERE m.student_id = NEW.student_id
                      AND r.mess_id = NEW.mess_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only current or past members of this mess can write a review';
    END IF;
END$$


CREATE TRIGGER trg_reviews_after_insert
AFTER INSERT ON reviews
FOR EACH ROW
BEGIN
    DECLARE v_manager_id INT;
    DECLARE v_student    VARCHAR(100);

    SELECT manager_id INTO v_manager_id FROM messes WHERE mess_id = NEW.mess_id;
    SELECT full_name  INTO v_student    FROM users  WHERE user_id = NEW.student_id;

    INSERT INTO notifications (user_id, message)
    VALUES (v_manager_id, CONCAT('New review from ', v_student, ': ', NEW.rating, ' out of 5.'));
END$$

DELIMITER ;
