-- ====================================================================
-- fn_member_outstanding(member_id)
-- How much rent a member still owes: all dues minus the money paid for them.
-- Advance payments are not counted, they are not linked to a due.
-- ====================================================================
USE mess_finder;

DROP FUNCTION IF EXISTS fn_member_outstanding;

DELIMITER $$
CREATE FUNCTION fn_member_outstanding (p_member_id INT)
RETURNS DECIMAL(10,2)
READS SQL DATA
BEGIN
    DECLARE v_due  DECIMAL(10,2);
    DECLARE v_paid DECIMAL(10,2);

    SELECT COALESCE(SUM(amount), 0)
      INTO v_due
      FROM rent_dues
     WHERE member_id = p_member_id;

    SELECT COALESCE(SUM(amount), 0)
      INTO v_paid
      FROM payments
     WHERE member_id = p_member_id
       AND due_id IS NOT NULL;

    RETURN v_due - v_paid;
END$$
DELIMITER ;
