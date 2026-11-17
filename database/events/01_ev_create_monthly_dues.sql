-- ====================================================================
-- ev_create_monthly_dues
-- Runs once a month, a few minutes after midnight on the 1st, and creates
-- the rent due of the new month for every member.
-- (The MySQL event scheduler must be ON. It is ON by default in MySQL 8.
--  Check with: SHOW VARIABLES LIKE 'event_scheduler';)
-- ====================================================================
USE mess_finder;

DROP EVENT IF EXISTS ev_create_monthly_dues;

DELIMITER $$
CREATE EVENT ev_create_monthly_dues
    ON SCHEDULE EVERY 1 MONTH
    STARTS TIMESTAMP(DATE_ADD(LAST_DAY(CURDATE()), INTERVAL 1 DAY), '00:05:00')
    ON COMPLETION PRESERVE
    ENABLE
    COMMENT 'Creates the rent due of the new month for every member'
DO
BEGIN
    CALL sp_generate_monthly_dues(CURDATE(), @dues_created);
END$$
DELIMITER ;
