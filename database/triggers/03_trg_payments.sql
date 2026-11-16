-- ====================================================================
-- Triggers of payments
--
-- BEFORE INSERT: the money paid for a due can never be more than the due.
-- AFTER INSERT:
--   * the due becomes partial (some paid) or paid (all paid)
--   * the student (if the member has an account) gets a notification
-- ====================================================================
USE mess_finder;

DROP TRIGGER IF EXISTS trg_payments_before_insert;
DROP TRIGGER IF EXISTS trg_payments_after_insert;

DELIMITER $$

CREATE TRIGGER trg_payments_before_insert
BEFORE INSERT ON payments
FOR EACH ROW
BEGIN
    DECLARE v_due_amount DECIMAL(10,2);
    DECLARE v_paid_so_far DECIMAL(10,2);

    IF NEW.due_id IS NOT NULL THEN
        SELECT amount INTO v_due_amount FROM rent_dues WHERE due_id = NEW.due_id;

        SELECT COALESCE(SUM(amount), 0)
          INTO v_paid_so_far
          FROM payments
         WHERE due_id = NEW.due_id;

        IF v_paid_so_far + NEW.amount > v_due_amount THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payment is more than the remaining due';
        END IF;
    END IF;
END$$


CREATE TRIGGER trg_payments_after_insert
AFTER INSERT ON payments
FOR EACH ROW
BEGIN
    DECLARE v_due_amount DECIMAL(10,2);
    DECLARE v_paid       DECIMAL(10,2);
    DECLARE v_student_id INT;

    IF NEW.due_id IS NOT NULL THEN
        SELECT amount INTO v_due_amount FROM rent_dues WHERE due_id = NEW.due_id;
        SELECT SUM(amount) INTO v_paid FROM payments WHERE due_id = NEW.due_id;

        UPDATE rent_dues
           SET status = CASE
                            WHEN v_paid >= v_due_amount THEN 'paid'
                            WHEN v_paid > 0             THEN 'partial'
                            ELSE status
                        END
         WHERE due_id = NEW.due_id;
    END IF;

    SELECT student_id INTO v_student_id FROM mess_members WHERE member_id = NEW.member_id;

    IF v_student_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, message)
        VALUES (v_student_id,
                CONCAT('Payment of ', FORMAT(NEW.amount, 0), ' BDT received (', NEW.payment_type, ').'));
    END IF;
END$$

DELIMITER ;
