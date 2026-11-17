-- ====================================================================
-- Triggers of visit_requests, complaints and messes
--
--   * visit request: the visit time must be in the future; the manager is
--     told about a new request; the student is told when it is confirmed or rejected
--   * complaint: every admin is told about a new complaint; the person who
--     complained is told when the status changes
--   * mess: the admins are told about a new mess; the manager is told when
--     the status of the mess changes (verified, suspended, closed)
-- ====================================================================
USE mess_finder;

DROP TRIGGER IF EXISTS trg_visit_requests_before_insert;
DROP TRIGGER IF EXISTS trg_visit_requests_after_insert;
DROP TRIGGER IF EXISTS trg_visit_requests_after_update;
DROP TRIGGER IF EXISTS trg_complaints_after_insert;
DROP TRIGGER IF EXISTS trg_complaints_after_update;
DROP TRIGGER IF EXISTS trg_messes_after_insert;
DROP TRIGGER IF EXISTS trg_messes_after_update;

DELIMITER $$

CREATE TRIGGER trg_visit_requests_before_insert
BEFORE INSERT ON visit_requests
FOR EACH ROW
BEGIN
    DECLARE v_status VARCHAR(20);

    SELECT status INTO v_status FROM messes WHERE mess_id = NEW.mess_id;
    IF v_status <> 'verified' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only a verified mess can be visited';
    END IF;
    IF NEW.visit_time <= NOW() THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Visit time must be in the future';
    END IF;
END$$


CREATE TRIGGER trg_visit_requests_after_insert
AFTER INSERT ON visit_requests
FOR EACH ROW
BEGIN
    DECLARE v_manager_id INT;
    DECLARE v_student    VARCHAR(100);

    SELECT manager_id INTO v_manager_id FROM messes WHERE mess_id = NEW.mess_id;
    SELECT full_name  INTO v_student    FROM users  WHERE user_id = NEW.student_id;

    INSERT INTO notifications (user_id, message)
    VALUES (v_manager_id,
            CONCAT(v_student, ' requested a visit on ', DATE_FORMAT(NEW.visit_time, '%e %b, %l:%i %p'), '.'));
END$$


CREATE TRIGGER trg_visit_requests_after_update
AFTER UPDATE ON visit_requests
FOR EACH ROW
BEGIN
    DECLARE v_mess_name VARCHAR(120);

    IF OLD.status <> NEW.status AND NEW.status IN ('confirmed', 'rejected') THEN
        SELECT mess_name INTO v_mess_name FROM messes WHERE mess_id = NEW.mess_id;

        INSERT INTO notifications (user_id, message)
        VALUES (NEW.student_id,
                CONCAT('Your visit to ', v_mess_name, ' was ', NEW.status, ' (',
                       DATE_FORMAT(NEW.visit_time, '%e %b, %l:%i %p'), ').'));
    END IF;
END$$


CREATE TRIGGER trg_complaints_after_insert
AFTER INSERT ON complaints
FOR EACH ROW
BEGIN
    INSERT INTO notifications (user_id, message)
    SELECT user_id, CONCAT('New complaint: ', NEW.subject)
      FROM users
     WHERE role = 'admin' AND is_active = 1;
END$$


CREATE TRIGGER trg_complaints_after_update
AFTER UPDATE ON complaints
FOR EACH ROW
BEGIN
    IF OLD.status <> NEW.status THEN
        INSERT INTO notifications (user_id, message)
        VALUES (NEW.complainant_id,
                CONCAT('Your complaint "', NEW.subject, '" is now ', REPLACE(NEW.status, '_', ' '), '.'));
    END IF;
END$$


CREATE TRIGGER trg_messes_after_insert
AFTER INSERT ON messes
FOR EACH ROW
BEGIN
    IF NEW.status = 'pending' THEN
        INSERT INTO notifications (user_id, message)
        SELECT user_id, CONCAT('New mess waiting for verification: ', NEW.mess_name, '.')
          FROM users
         WHERE role = 'admin' AND is_active = 1;
    END IF;
END$$


CREATE TRIGGER trg_messes_after_update
AFTER UPDATE ON messes
FOR EACH ROW
BEGIN
    IF OLD.status <> NEW.status THEN
        INSERT INTO notifications (user_id, message)
        VALUES (NEW.manager_id,
                CONCAT('Your mess ', NEW.mess_name, ' is now ', NEW.status, '.'));
    END IF;
END$$

DELIMITER ;
