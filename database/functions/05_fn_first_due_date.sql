-- ====================================================================
-- fn_first_due_date(join_date)
-- Last day to pay the rent of the month a member joins.
-- Rule: the 10th of that month, but never earlier than 7 days after joining.
-- ====================================================================
USE mess_finder;

DROP FUNCTION IF EXISTS fn_first_due_date;

DELIMITER $$
CREATE FUNCTION fn_first_due_date (p_join_date DATE)
RETURNS DATE
DETERMINISTIC
NO SQL
BEGIN
    DECLARE v_tenth DATE;

    SET v_tenth = DATE_ADD(DATE_FORMAT(p_join_date, '%Y-%m-01'), INTERVAL 9 DAY);

    RETURN GREATEST(v_tenth, DATE_ADD(p_join_date, INTERVAL 7 DAY));
END$$
DELIMITER ;
