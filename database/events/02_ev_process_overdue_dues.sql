-- ====================================================================
-- ev_process_overdue_dues
-- Runs every day after midnight. Marks unpaid dues whose deadline has
-- passed as overdue and sends the notifications.
-- ====================================================================
USE mess_finder;

DROP EVENT IF EXISTS ev_process_overdue_dues;

DELIMITER $$
CREATE EVENT ev_process_overdue_dues
    ON SCHEDULE EVERY 1 DAY
    STARTS TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 1 DAY), '00:10:00')
    ON COMPLETION PRESERVE
    ENABLE
    COMMENT 'Marks unpaid dues as overdue after the deadline'
DO
BEGIN
    CALL sp_process_overdue_dues(@dues_marked);
END$$
DELIMITER ;
