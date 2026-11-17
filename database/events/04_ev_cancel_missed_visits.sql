-- ====================================================================
-- ev_cancel_missed_visits
-- Runs every hour. A visit request that is still pending when the visit time
-- has passed was never answered by the manager, so it is cancelled.
-- ====================================================================
USE mess_finder;

DROP EVENT IF EXISTS ev_cancel_missed_visits;

DELIMITER $$
CREATE EVENT ev_cancel_missed_visits
    ON SCHEDULE EVERY 1 HOUR
    STARTS CURRENT_TIMESTAMP + INTERVAL 1 HOUR
    ON COMPLETION PRESERVE
    ENABLE
    COMMENT 'Cancels pending visit requests whose time has passed'
DO
BEGIN
    UPDATE visit_requests
       SET status = 'cancelled'
     WHERE status = 'pending'
       AND visit_time < NOW();
END$$
DELIMITER ;
