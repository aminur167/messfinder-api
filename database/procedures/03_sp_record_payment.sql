-- ====================================================================
-- sp_record_payment
-- The manager records money received from a member.
--   monthly payment: p_due_id is the due it pays (can be a part of it)
--   advance payment: p_due_id is NULL
-- The due row is locked first, so two payments for the same due are counted
-- one after another. A trigger blocks paying more than the due and updates
-- the due status to partial or paid.
-- ====================================================================
USE mess_finder;

DROP PROCEDURE IF EXISTS sp_record_payment;

DELIMITER $$
CREATE PROCEDURE sp_record_payment (
    IN  p_manager_id  INT,
    IN  p_member_id   INT,
    IN  p_due_id      INT,            -- NULL for an advance payment
    IN  p_amount      DECIMAL(10,2),
    IN  p_method      VARCHAR(10),    -- 'cash', 'bkash' or 'nagad'
    IN  p_paid_at     DATETIME,       -- NULL = now
    OUT p_payment_id  INT
)
BEGIN
    DECLARE v_manager_id INT;
    DECLARE v_due_member INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    -- the member must belong to this manager's mess
    SELECT me.manager_id
      INTO v_manager_id
      FROM mess_members AS m
      JOIN seats AS s   ON s.seat_id  = m.seat_id
      JOIN rooms AS r   ON r.room_id  = s.room_id
      JOIN messes AS me ON me.mess_id = r.mess_id
     WHERE m.member_id = p_member_id;

    IF v_manager_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Member not found';
    END IF;
    IF v_manager_id <> p_manager_id THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This member does not belong to your mess';
    END IF;

    IF p_due_id IS NOT NULL THEN
        -- lock the due, then check it is really this member's due
        SELECT member_id
          INTO v_due_member
          FROM rent_dues
         WHERE due_id = p_due_id
           FOR UPDATE;

        IF v_due_member IS NULL OR v_due_member <> p_member_id THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This due does not belong to the member';
        END IF;
    END IF;

    INSERT INTO payments (member_id, due_id, amount, payment_type, method, paid_at)
    VALUES (p_member_id,
            p_due_id,
            p_amount,
            IF(p_due_id IS NULL, 'advance', 'monthly'),
            p_method,
            COALESCE(p_paid_at, NOW()));

    SET p_payment_id = LAST_INSERT_ID();

    COMMIT;
END$$
DELIMITER ;
