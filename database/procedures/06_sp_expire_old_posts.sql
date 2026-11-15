-- ====================================================================
-- sp_expire_old_posts
-- Open posts older than 30 days become "expired". After that nobody can
-- comment on them. Called by the event ev_expire_old_posts every day.
-- ====================================================================
USE mess_finder;

DROP PROCEDURE IF EXISTS sp_expire_old_posts;

DELIMITER $$
CREATE PROCEDURE sp_expire_old_posts (
    OUT p_vacancy_posts  INT,
    OUT p_wanted_posts   INT
)
BEGIN
    UPDATE vacancy_posts
       SET status = 'expired'
     WHERE status = 'open'
       AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
    SET p_vacancy_posts = ROW_COUNT();

    UPDATE seat_wanted_posts
       SET status = 'expired'
     WHERE status = 'open'
       AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
    SET p_wanted_posts = ROW_COUNT();
END$$
DELIMITER ;
