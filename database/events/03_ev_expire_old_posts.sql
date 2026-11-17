-- ====================================================================
-- ev_expire_old_posts
-- Runs every day. Open posts older than 30 days become expired.
-- ====================================================================
USE mess_finder;

DROP EVENT IF EXISTS ev_expire_old_posts;

DELIMITER $$
CREATE EVENT ev_expire_old_posts
    ON SCHEDULE EVERY 1 DAY
    STARTS TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 1 DAY), '00:20:00')
    ON COMPLETION PRESERVE
    ENABLE
    COMMENT 'Expires vacancy and seat wanted posts older than 30 days'
DO
BEGIN
    CALL sp_expire_old_posts(@vacancy_expired, @wanted_expired);
END$$
DELIMITER ;
