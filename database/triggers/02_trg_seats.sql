-- ====================================================================
-- Triggers of seats
--
-- BEFORE UPDATE: a seat that has an active member cannot become inactive or free by hand.
-- AFTER UPDATE:
--   * rent changed   -> the old and new rent are saved in seat_rent_log
--   * seat not free anymore -> vacancy posts that have no free seat left are closed
-- ====================================================================
USE mess_finder;

DROP TRIGGER IF EXISTS trg_seats_before_update;
DROP TRIGGER IF EXISTS trg_seats_after_update;

DELIMITER $$

CREATE TRIGGER trg_seats_before_update
BEFORE UPDATE ON seats
FOR EACH ROW
BEGIN
    IF OLD.status = 'booked' AND NEW.status IN ('available', 'inactive') THEN
        -- allowed only when nobody lives in the seat any more
        IF EXISTS (SELECT 1 FROM mess_members WHERE seat_id = NEW.seat_id AND status = 'active') THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This seat has an active member';
        END IF;
    END IF;
END$$


CREATE TRIGGER trg_seats_after_update
AFTER UPDATE ON seats
FOR EACH ROW
BEGIN
    IF OLD.monthly_rent <> NEW.monthly_rent THEN
        INSERT INTO seat_rent_log (seat_id, old_rent, new_rent)
        VALUES (NEW.seat_id, OLD.monthly_rent, NEW.monthly_rent);
    END IF;

    IF OLD.status = 'available' AND NEW.status <> 'available' THEN
        -- close the open posts of this seat that now have no free seat at all
        UPDATE vacancy_posts AS vp
           SET vp.status = 'closed'
         WHERE vp.status = 'open'
           AND vp.post_id IN (SELECT ps.post_id FROM post_seats AS ps WHERE ps.seat_id = NEW.seat_id)
           AND NOT EXISTS (SELECT 1
                             FROM post_seats AS ps2
                             JOIN seats AS s2 ON s2.seat_id = ps2.seat_id
                            WHERE ps2.post_id = vp.post_id
                              AND s2.status = 'available');
    END IF;
END$$

DELIMITER ;
