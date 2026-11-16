-- ====================================================================
-- Triggers of mess_members
--
-- BEFORE triggers refuse wrong data (cross-table rules a CHECK cannot do):
--   * gender must match the mess type (boys mess: male, girls mess: female)
--   * a linked member must have the same gender as the student account
--   * a member can be added only to a free seat
-- AFTER triggers keep other tables in step:
--   * member added   -> seat becomes booked, the student gets a notification
--   * member left    -> seat becomes free again, the student gets a notification
-- ====================================================================
USE mess_finder;

DROP TRIGGER IF EXISTS trg_mess_members_before_insert;
DROP TRIGGER IF EXISTS trg_mess_members_before_update;
DROP TRIGGER IF EXISTS trg_mess_members_after_insert;
DROP TRIGGER IF EXISTS trg_mess_members_after_update;

DELIMITER $$

CREATE TRIGGER trg_mess_members_before_insert
BEFORE INSERT ON mess_members
FOR EACH ROW
BEGIN
    DECLARE v_mess_type      VARCHAR(10);
    DECLARE v_seat_status    VARCHAR(20);
    DECLARE v_student_gender VARCHAR(10);

    SELECT me.mess_type, s.status
      INTO v_mess_type, v_seat_status
      FROM seats AS s
      JOIN rooms AS r   ON r.room_id  = s.room_id
      JOIN messes AS me ON me.mess_id = r.mess_id
     WHERE s.seat_id = NEW.seat_id;

    IF (v_mess_type = 'boys' AND NEW.gender <> 'male')
       OR (v_mess_type = 'girls' AND NEW.gender <> 'female') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Gender does not match the mess type';
    END IF;

    IF NEW.student_id IS NOT NULL THEN
        SELECT gender INTO v_student_gender
          FROM student_profiles
         WHERE student_id = NEW.student_id;

        IF v_student_gender <> NEW.gender THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Member gender does not match the student account';
        END IF;
    END IF;

    IF NEW.status = 'active' AND v_seat_status <> 'available' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This seat is not available';
    END IF;
END$$


CREATE TRIGGER trg_mess_members_before_update
BEFORE UPDATE ON mess_members
FOR EACH ROW
BEGIN
    DECLARE v_mess_type      VARCHAR(10);
    DECLARE v_student_gender VARCHAR(10);

    IF NEW.seat_id <> OLD.seat_id THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'The seat of a member cannot be changed';
    END IF;

    IF OLD.status = 'left' AND NEW.status = 'active' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A member who left cannot be activated again, add a new member';
    END IF;

    -- check the gender rules again only if something they depend on changed
    IF NEW.gender <> OLD.gender OR NOT (NEW.student_id <=> OLD.student_id) THEN
        SELECT me.mess_type
          INTO v_mess_type
          FROM seats AS s
          JOIN rooms AS r   ON r.room_id  = s.room_id
          JOIN messes AS me ON me.mess_id = r.mess_id
         WHERE s.seat_id = NEW.seat_id;

        IF (v_mess_type = 'boys' AND NEW.gender <> 'male')
           OR (v_mess_type = 'girls' AND NEW.gender <> 'female') THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Gender does not match the mess type';
        END IF;

        IF NEW.student_id IS NOT NULL THEN
            SELECT gender INTO v_student_gender
              FROM student_profiles
             WHERE student_id = NEW.student_id;

            IF v_student_gender <> NEW.gender THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Member gender does not match the student account';
            END IF;
        END IF;
    END IF;
END$$


CREATE TRIGGER trg_mess_members_after_insert
AFTER INSERT ON mess_members
FOR EACH ROW
BEGIN
    DECLARE v_mess_name  VARCHAR(120);
    DECLARE v_room_no    VARCHAR(10);
    DECLARE v_seat_label VARCHAR(10);

    IF NEW.status = 'active' THEN
        UPDATE seats SET status = 'booked' WHERE seat_id = NEW.seat_id;

        IF NEW.student_id IS NOT NULL THEN
            SELECT me.mess_name, r.room_no, s.seat_label
              INTO v_mess_name, v_room_no, v_seat_label
              FROM seats AS s
              JOIN rooms AS r   ON r.room_id  = s.room_id
              JOIN messes AS me ON me.mess_id = r.mess_id
             WHERE s.seat_id = NEW.seat_id;

            INSERT INTO notifications (user_id, message)
            VALUES (NEW.student_id,
                    CONCAT('You were added to ', v_mess_name, ' (room ', v_room_no, ', seat ', v_seat_label, ').'));
        END IF;
    END IF;
END$$


CREATE TRIGGER trg_mess_members_after_update
AFTER UPDATE ON mess_members
FOR EACH ROW
BEGIN
    DECLARE v_mess_name VARCHAR(120);

    IF OLD.status = 'active' AND NEW.status = 'left' THEN
        -- the seat is free again (an inactive seat stays inactive)
        UPDATE seats
           SET status = 'available'
         WHERE seat_id = NEW.seat_id
           AND status = 'booked';

        IF NEW.student_id IS NOT NULL THEN
            SELECT me.mess_name
              INTO v_mess_name
              FROM seats AS s
              JOIN rooms AS r   ON r.room_id  = s.room_id
              JOIN messes AS me ON me.mess_id = r.mess_id
             WHERE s.seat_id = NEW.seat_id;

            INSERT INTO notifications (user_id, message)
            VALUES (NEW.student_id,
                    CONCAT('You were marked as left from ', v_mess_name, ' on ',
                           DATE_FORMAT(NEW.leave_date, '%e %b %Y'), '.'));
        END IF;
    END IF;
END$$

DELIMITER ;
