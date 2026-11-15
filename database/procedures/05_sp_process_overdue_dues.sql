-- ====================================================================
-- sp_process_overdue_dues
-- Finds dues where nothing was paid and the deadline has passed, marks them
-- as overdue, and sends a notification to the member (if linked to an
-- account) and to the manager. A CURSOR handles the dues one by one.
-- A due that was partly paid stays "partial" (the manager still sees the rest).
-- Called by the event ev_process_overdue_dues every day.
-- ====================================================================
USE mess_finder;

DROP PROCEDURE IF EXISTS sp_process_overdue_dues;

DELIMITER $$
CREATE PROCEDURE sp_process_overdue_dues (
    OUT p_marked INT    -- how many dues were marked overdue
)
BEGIN
    DECLARE v_due_id     INT;
    DECLARE v_month_text VARCHAR(20);
    DECLARE v_member     VARCHAR(100);
    DECLARE v_student_id INT;
    DECLARE v_manager_id INT;
    DECLARE v_done       TINYINT DEFAULT 0;

    DECLARE cur_dues CURSOR FOR
        SELECT d.due_id,
               DATE_FORMAT(d.due_month, '%M %Y'),
               m.full_name,
               m.student_id,
               me.manager_id
          FROM rent_dues AS d
          JOIN mess_members AS m ON m.member_id = d.member_id
          JOIN seats AS s        ON s.seat_id   = m.seat_id
          JOIN rooms AS r        ON r.room_id   = s.room_id
          JOIN messes AS me      ON me.mess_id  = r.mess_id
         WHERE d.status = 'due'
           AND d.due_date < CURDATE();

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;

    SET p_marked = 0;

    OPEN cur_dues;

    due_loop: LOOP
        FETCH cur_dues INTO v_due_id, v_month_text, v_member, v_student_id, v_manager_id;
        IF v_done = 1 THEN
            LEAVE due_loop;
        END IF;

        UPDATE rent_dues SET status = 'overdue' WHERE due_id = v_due_id;

        IF v_student_id IS NOT NULL THEN
            INSERT INTO notifications (user_id, message)
            VALUES (v_student_id, CONCAT('Your rent for ', v_month_text, ' is overdue.'));
        END IF;

        INSERT INTO notifications (user_id, message)
        VALUES (v_manager_id, CONCAT('Overdue rent: ', v_member, ' (', v_month_text, ').'));

        SET p_marked = p_marked + 1;
    END LOOP;

    CLOSE cur_dues;
END$$
DELIMITER ;
