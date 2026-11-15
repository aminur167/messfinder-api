-- ====================================================================
-- sp_add_member
-- The manager gives a seat to a person. This is how a "booking" happens.
--
-- Everything runs in ONE transaction, so it either all happens or nothing does:
--   1. lock the seat row (two requests for the same seat wait for each other)
--   2. check the seat belongs to this manager and is free
--   3. add the member (a trigger then marks the seat as booked)
--   4. create the rent due of the joining month (full month rent)
--   5. record the advance payment, if there is one
-- If any step fails, ROLLBACK undoes the earlier steps.
--
-- When p_student_id is given, name, phone and gender are taken from the account.
-- ====================================================================
USE mess_finder;

DROP PROCEDURE IF EXISTS sp_add_member;

DELIMITER $$
CREATE PROCEDURE sp_add_member (
    IN  p_manager_id      INT,
    IN  p_seat_id         INT,
    IN  p_student_id      INT,            -- NULL when the member has no account
    IN  p_full_name       VARCHAR(100),   -- can be NULL when p_student_id is given
    IN  p_phone           VARCHAR(20),    -- can be NULL when p_student_id is given
    IN  p_gender          VARCHAR(10),    -- 'male' or 'female', can be NULL when p_student_id is given
    IN  p_occupation      VARCHAR(100),
    IN  p_monthly_rent    DECIMAL(10,2),  -- NULL = use the current rent of the seat
    IN  p_advance_amount  DECIMAL(10,2),  -- agreed advance, received now. 0 = no advance
    IN  p_payment_method  VARCHAR(10),    -- 'cash', 'bkash' or 'nagad'
    IN  p_join_date       DATE,
    OUT p_member_id       INT
)
BEGIN
    DECLARE v_seat_manager INT;
    DECLARE v_mess_status  VARCHAR(20);
    DECLARE v_seat_status  VARCHAR(20);
    DECLARE v_seat_rent    DECIMAL(10,2);
    DECLARE v_name         VARCHAR(100);
    DECLARE v_phone        VARCHAR(20);
    DECLARE v_gender       VARCHAR(10);
    DECLARE v_rent         DECIMAL(10,2);
    DECLARE v_due_date     DATE;

    -- any error undoes everything and is sent back to the caller
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    -- step 1: lock the seat row until this transaction ends
    SELECT me.manager_id, me.status, s.status, s.monthly_rent
      INTO v_seat_manager, v_mess_status, v_seat_status, v_seat_rent
      FROM seats AS s
      JOIN rooms AS r   ON r.room_id  = s.room_id
      JOIN messes AS me ON me.mess_id = r.mess_id
     WHERE s.seat_id = p_seat_id
       FOR UPDATE OF s;

    -- step 2: checks
    IF v_seat_manager IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seat not found';
    END IF;
    IF v_seat_manager <> p_manager_id THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This seat does not belong to your mess';
    END IF;
    IF v_mess_status <> 'verified' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Your mess is not verified yet';
    END IF;
    IF v_seat_status <> 'available' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This seat is not available';
    END IF;

    -- member details: from the student account if linked, otherwise from the parameters
    IF p_student_id IS NOT NULL THEN
        SELECT u.full_name, u.phone, sp.gender
          INTO v_name, v_phone, v_gender
          FROM users AS u
          JOIN student_profiles AS sp ON sp.student_id = u.user_id
         WHERE u.user_id = p_student_id
           AND u.is_active = 1;

        IF v_name IS NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Student account not found or blocked';
        END IF;
        SET v_name  = COALESCE(p_full_name, v_name);
        SET v_phone = COALESCE(p_phone, v_phone);
    ELSE
        IF p_full_name IS NULL OR p_phone IS NULL OR p_gender IS NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Name, phone and gender are required for a member without an account';
        END IF;
        SET v_name   = p_full_name;
        SET v_phone  = p_phone;
        SET v_gender = p_gender;
    END IF;

    SET v_rent = COALESCE(p_monthly_rent, v_seat_rent);

    -- step 3: add the member (triggers check the gender rule and mark the seat as booked)
    INSERT INTO mess_members
           (seat_id, student_id, full_name, phone, gender, occupation,
            monthly_rent, advance_amount, join_date, status)
    VALUES (p_seat_id, p_student_id, v_name, v_phone, v_gender, p_occupation,
            v_rent, COALESCE(p_advance_amount, 0), p_join_date, 'active');

    SET p_member_id = LAST_INSERT_ID();

    -- step 4: rent due of the joining month, full month rent
    SET v_due_date = fn_first_due_date(p_join_date);
    INSERT INTO rent_dues (member_id, due_month, amount, due_date, status)
    VALUES (p_member_id,
            DATE_FORMAT(p_join_date, '%Y-%m-01'),
            v_rent,
            v_due_date,
            IF(v_due_date < CURDATE(), 'overdue', 'due'));

    -- step 5: advance payment
    IF COALESCE(p_advance_amount, 0) > 0 THEN
        INSERT INTO payments (member_id, due_id, amount, payment_type, method, paid_at)
        VALUES (p_member_id, NULL, p_advance_amount, 'advance',
                COALESCE(p_payment_method, 'cash'), TIMESTAMP(p_join_date, CURTIME()));
    END IF;

    COMMIT;
END$$
DELIMITER ;
