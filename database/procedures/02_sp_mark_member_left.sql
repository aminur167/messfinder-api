-- ====================================================================
-- sp_mark_member_left
-- The manager says a member has left. The row stays (soft delete), only
-- status and leave_date change. A trigger then makes the seat free again.
-- Rent of the leaving month stays due in full; no new dues are made after that.
-- ====================================================================
USE mess_finder;

DROP PROCEDURE IF EXISTS sp_mark_member_left;

DELIMITER $$
CREATE PROCEDURE sp_mark_member_left (
    IN p_manager_id  INT,
    IN p_member_id   INT,
    IN p_leave_date  DATE
)
BEGIN
    DECLARE v_manager_id INT;
    DECLARE v_status     VARCHAR(10);
    DECLARE v_join_date  DATE;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    -- lock the member row so two clicks cannot change it twice
    SELECT me.manager_id, m.status, m.join_date
      INTO v_manager_id, v_status, v_join_date
      FROM mess_members AS m
      JOIN seats AS s   ON s.seat_id  = m.seat_id
      JOIN rooms AS r   ON r.room_id  = s.room_id
      JOIN messes AS me ON me.mess_id = r.mess_id
     WHERE m.member_id = p_member_id
       FOR UPDATE OF m;

    IF v_manager_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Member not found';
    END IF;
    IF v_manager_id <> p_manager_id THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This member does not belong to your mess';
    END IF;
    IF v_status <> 'active' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This member has already left';
    END IF;
    IF p_leave_date < v_join_date THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Leave date cannot be before the join date';
    END IF;

    UPDATE mess_members
       SET status = 'left',
           leave_date = p_leave_date
     WHERE member_id = p_member_id;

    COMMIT;
END$$
DELIMITER ;
