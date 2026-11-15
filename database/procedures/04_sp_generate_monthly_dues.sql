-- ====================================================================
-- sp_generate_monthly_dues
-- Creates the rent due of one month for every member who has to pay it.
-- A CURSOR walks through the members one by one.
-- Members who already have a due for that month are skipped, so it is safe
-- to run the procedure twice.
-- Called by the event ev_create_monthly_dues on the 1st of every month.
-- ====================================================================
USE mess_finder;

DROP PROCEDURE IF EXISTS sp_generate_monthly_dues;

DELIMITER $$
CREATE PROCEDURE sp_generate_monthly_dues (
    IN  p_month    DATE,   -- any day of the month
    OUT p_created  INT     -- how many dues were created
)
BEGIN
    DECLARE v_month_start DATE;
    DECLARE v_due_date    DATE;
    DECLARE v_member_id   INT;
    DECLARE v_rent        DECIMAL(10,2);
    DECLARE v_done        TINYINT DEFAULT 0;

    -- members who joined before the end of the month, are still active (or left during
    -- the month), and do not have a due for the month yet
    DECLARE cur_members CURSOR FOR
        SELECT m.member_id, m.monthly_rent
          FROM mess_members AS m
         WHERE m.join_date <= LAST_DAY(v_month_start)
           AND (m.status = 'active' OR m.leave_date >= v_month_start)
           AND NOT EXISTS (SELECT 1
                             FROM rent_dues AS d
                            WHERE d.member_id = m.member_id
                              AND d.due_month = v_month_start);

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;

    SET v_month_start = DATE_FORMAT(p_month, '%Y-%m-01');
    SET v_due_date    = DATE_ADD(v_month_start, INTERVAL 9 DAY);   -- the 10th
    SET p_created     = 0;

    OPEN cur_members;

    member_loop: LOOP
        FETCH cur_members INTO v_member_id, v_rent;
        IF v_done = 1 THEN
            LEAVE member_loop;
        END IF;

        INSERT INTO rent_dues (member_id, due_month, amount, due_date, status)
        VALUES (v_member_id, v_month_start, v_rent, v_due_date,
                IF(v_due_date < CURDATE(), 'overdue', 'due'));

        SET p_created = p_created + 1;
    END LOOP;

    CLOSE cur_members;
END$$
DELIMITER ;
