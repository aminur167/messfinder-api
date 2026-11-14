-- ====================================================================
-- fn_available_seats(mess_id)
-- Number of free seats in a mess (inactive rooms and seats are not counted).
-- ====================================================================
USE mess_finder;

DROP FUNCTION IF EXISTS fn_available_seats;

DELIMITER $$
CREATE FUNCTION fn_available_seats (p_mess_id INT)
RETURNS INT
READS SQL DATA
BEGIN
    DECLARE v_free INT;

    SELECT COUNT(*)
      INTO v_free
      FROM seats AS s
      JOIN rooms AS r ON r.room_id = s.room_id
     WHERE r.mess_id = p_mess_id
       AND r.is_active = 1
       AND s.status = 'available';

    RETURN v_free;
END$$
DELIMITER ;
