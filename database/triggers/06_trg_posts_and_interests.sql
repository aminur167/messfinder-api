-- ====================================================================
-- Triggers of the newsfeed: vacancy_posts, post_seats, interests, post_comments
--
--   * a vacancy post can be made only by a verified mess
--   * a post can advertise only free seats of its own mess
--   * Interested can be pressed only on a verified mess; the manager is told
--   * comments are closed on expired or removed posts; the owner of the post
--     is told about every new comment
-- ====================================================================
USE mess_finder;

DROP TRIGGER IF EXISTS trg_vacancy_posts_before_insert;
DROP TRIGGER IF EXISTS trg_post_seats_before_insert;
DROP TRIGGER IF EXISTS trg_interests_before_insert;
DROP TRIGGER IF EXISTS trg_interests_after_insert;
DROP TRIGGER IF EXISTS trg_post_comments_before_insert;
DROP TRIGGER IF EXISTS trg_post_comments_after_insert;

DELIMITER $$

CREATE TRIGGER trg_vacancy_posts_before_insert
BEFORE INSERT ON vacancy_posts
FOR EACH ROW
BEGIN
    DECLARE v_status VARCHAR(20);

    SELECT status INTO v_status FROM messes WHERE mess_id = NEW.mess_id;
    IF v_status <> 'verified' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only a verified mess can make a post';
    END IF;
END$$


CREATE TRIGGER trg_post_seats_before_insert
BEFORE INSERT ON post_seats
FOR EACH ROW
BEGIN
    DECLARE v_post_mess INT;
    DECLARE v_seat_mess INT;
    DECLARE v_seat_status VARCHAR(20);

    SELECT mess_id INTO v_post_mess FROM vacancy_posts WHERE post_id = NEW.post_id;

    SELECT r.mess_id, s.status
      INTO v_seat_mess, v_seat_status
      FROM seats AS s
      JOIN rooms AS r ON r.room_id = s.room_id
     WHERE s.seat_id = NEW.seat_id;

    IF v_seat_mess <> v_post_mess THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This seat belongs to another mess';
    END IF;
    IF v_seat_status <> 'available' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only free seats can be posted';
    END IF;
END$$


CREATE TRIGGER trg_interests_before_insert
BEFORE INSERT ON interests
FOR EACH ROW
BEGIN
    DECLARE v_status VARCHAR(20);

    SELECT status INTO v_status FROM messes WHERE mess_id = NEW.mess_id;
    IF v_status <> 'verified' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only a verified mess can be marked as Interested';
    END IF;
END$$


CREATE TRIGGER trg_interests_after_insert
AFTER INSERT ON interests
FOR EACH ROW
BEGIN
    DECLARE v_manager_id INT;
    DECLARE v_student    VARCHAR(100);
    DECLARE v_mess_name  VARCHAR(120);

    SELECT manager_id, mess_name INTO v_manager_id, v_mess_name FROM messes WHERE mess_id = NEW.mess_id;
    SELECT full_name INTO v_student FROM users WHERE user_id = NEW.student_id;

    INSERT INTO notifications (user_id, message)
    VALUES (v_manager_id, CONCAT(v_student, ' is interested in ', v_mess_name, '.'));
END$$


CREATE TRIGGER trg_post_comments_before_insert
BEFORE INSERT ON post_comments
FOR EACH ROW
BEGIN
    DECLARE v_status VARCHAR(20);

    IF NEW.vacancy_post_id IS NOT NULL THEN
        SELECT status INTO v_status FROM vacancy_posts WHERE post_id = NEW.vacancy_post_id;
    ELSEIF NEW.wanted_post_id IS NOT NULL THEN
        SELECT status INTO v_status FROM seat_wanted_posts WHERE wanted_id = NEW.wanted_post_id;
    END IF;

    IF v_status IN ('expired', 'removed') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Comments are closed for this post';
    END IF;
END$$


CREATE TRIGGER trg_post_comments_after_insert
AFTER INSERT ON post_comments
FOR EACH ROW
BEGIN
    DECLARE v_owner INT;

    -- the owner of a vacancy post is the manager of the mess; of a seat wanted post, the student
    IF NEW.vacancy_post_id IS NOT NULL THEN
        SELECT me.manager_id
          INTO v_owner
          FROM vacancy_posts AS vp
          JOIN messes AS me ON me.mess_id = vp.mess_id
         WHERE vp.post_id = NEW.vacancy_post_id;
    ELSE
        SELECT student_id INTO v_owner FROM seat_wanted_posts WHERE wanted_id = NEW.wanted_post_id;
    END IF;

    IF v_owner IS NOT NULL AND v_owner <> NEW.user_id THEN
        INSERT INTO notifications (user_id, message)
        VALUES (v_owner, CONCAT('New comment on your post: ', LEFT(NEW.body, 80)));
    END IF;
END$$

DELIMITER ;
