-- ====================================================================
-- fn_avg_rating(mess_id)
-- Average overall rating of a mess, rounded to 2 decimals.
-- Returns NULL when the mess has no review yet.
-- ====================================================================
USE mess_finder;

DROP FUNCTION IF EXISTS fn_avg_rating;

DELIMITER $$
CREATE FUNCTION fn_avg_rating (p_mess_id INT)
RETURNS DECIMAL(3,2)
READS SQL DATA
BEGIN
    DECLARE v_avg DECIMAL(3,2);

    SELECT ROUND(AVG(rating), 2)
      INTO v_avg
      FROM reviews
     WHERE mess_id = p_mess_id;

    RETURN v_avg;
END$$
DELIMITER ;
