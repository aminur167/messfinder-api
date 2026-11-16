-- ====================================================================
-- sp_create_vacancy_post
-- A manager posts free seats on the newsfeed.
-- The seats come as a JSON list, for example [3, 5, 8]. JSON_TABLE turns the
-- list into rows so all the seats can be saved with one INSERT.
-- The post and its seats are saved in one transaction.
-- Triggers check that the mess is verified and every seat is a free seat of
-- this mess.
-- ====================================================================
USE mess_finder;

DROP PROCEDURE IF EXISTS sp_create_vacancy_post;

DELIMITER $$
CREATE PROCEDURE sp_create_vacancy_post (
    IN  p_manager_id      INT,
    IN  p_title           VARCHAR(150),
    IN  p_description     TEXT,
    IN  p_available_from  DATE,
    IN  p_seat_ids        JSON,       -- for example '[3, 5, 8]'
    OUT p_post_id         INT
)
BEGIN
    DECLARE v_mess_id INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    IF p_seat_ids IS NULL OR JSON_LENGTH(p_seat_ids) = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Choose at least one seat for the post';
    END IF;

    SELECT mess_id INTO v_mess_id FROM messes WHERE manager_id = p_manager_id;
    IF v_mess_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Create your mess before posting';
    END IF;

    START TRANSACTION;

    INSERT INTO vacancy_posts (mess_id, title, description, available_from)
    VALUES (v_mess_id, p_title, p_description, p_available_from);

    SET p_post_id = LAST_INSERT_ID();

    INSERT INTO post_seats (post_id, seat_id)
    SELECT p_post_id, jt.seat_id
      FROM JSON_TABLE(p_seat_ids, '$[*]' COLUMNS (seat_id INT PATH '$')) AS jt;

    COMMIT;
END$$
DELIMITER ;
