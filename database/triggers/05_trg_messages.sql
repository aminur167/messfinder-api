-- ====================================================================
-- Triggers of messages (chat)
--
-- BEFORE INSERT: the sender must be one of the two people of the chat:
--                the student, or the manager of the mess.
-- AFTER INSERT:
--   * conversations.last_message_at is updated (the inbox is sorted by it)
--   * the other person gets a notification. If an unread notification of
--     the same kind is already waiting, no second one is made.
-- ====================================================================
USE mess_finder;

DROP TRIGGER IF EXISTS trg_messages_before_insert;
DROP TRIGGER IF EXISTS trg_messages_after_insert;

DELIMITER $$

CREATE TRIGGER trg_messages_before_insert
BEFORE INSERT ON messages
FOR EACH ROW
BEGIN
    DECLARE v_student_id INT;
    DECLARE v_manager_id INT;

    SELECT c.student_id, me.manager_id
      INTO v_student_id, v_manager_id
      FROM conversations AS c
      JOIN messes AS me ON me.mess_id = c.mess_id
     WHERE c.conversation_id = NEW.conversation_id;

    IF NEW.sender_id <> v_student_id AND NEW.sender_id <> v_manager_id THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Sender is not part of this conversation';
    END IF;
END$$


CREATE TRIGGER trg_messages_after_insert
AFTER INSERT ON messages
FOR EACH ROW
BEGIN
    DECLARE v_student_id INT;
    DECLARE v_manager_id INT;
    DECLARE v_receiver   INT;
    DECLARE v_sender     VARCHAR(100);
    DECLARE v_text       VARCHAR(255);

    UPDATE conversations
       SET last_message_at = NEW.sent_at
     WHERE conversation_id = NEW.conversation_id;

    SELECT c.student_id, me.manager_id
      INTO v_student_id, v_manager_id
      FROM conversations AS c
      JOIN messes AS me ON me.mess_id = c.mess_id
     WHERE c.conversation_id = NEW.conversation_id;

    SET v_receiver = IF(NEW.sender_id = v_student_id, v_manager_id, v_student_id);
    SELECT full_name INTO v_sender FROM users WHERE user_id = NEW.sender_id;
    SET v_text = CONCAT('New message from ', v_sender, '.');

    IF NOT EXISTS (SELECT 1 FROM notifications
                    WHERE user_id = v_receiver AND is_read = 0 AND message = v_text) THEN
        INSERT INTO notifications (user_id, message) VALUES (v_receiver, v_text);
    END IF;
END$$

DELIMITER ;
