-- ====================================================================
-- sp_toggle_interest
-- The Interested button. First press adds the mess to the student's
-- Interested list, second press removes it.
-- The row is deleted first: if a row was deleted, the student pressed it
-- again; if nothing was deleted, the row is new.
-- ====================================================================
USE mess_finder;

DROP PROCEDURE IF EXISTS sp_toggle_interest;

DELIMITER $$
CREATE PROCEDURE sp_toggle_interest (
    IN  p_student_id     INT,
    IN  p_mess_id        INT,
    IN  p_post_id        INT,       -- post the button was pressed on, NULL if pressed on the mess page
    OUT p_is_interested  TINYINT    -- 1 = now interested, 0 = removed
)
BEGIN
    -- two quick double clicks can try to add the same row twice, treat that as "interested"
    DECLARE CONTINUE HANDLER FOR 1062 SET p_is_interested = 1;

    DELETE FROM interests
     WHERE student_id = p_student_id
       AND mess_id = p_mess_id;

    IF ROW_COUNT() > 0 THEN
        SET p_is_interested = 0;
    ELSE
        INSERT INTO interests (student_id, mess_id, post_id)
        VALUES (p_student_id, p_mess_id, p_post_id);
        SET p_is_interested = 1;
    END IF;
END$$
DELIMITER ;
