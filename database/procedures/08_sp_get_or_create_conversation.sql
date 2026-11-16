-- ====================================================================
-- sp_get_or_create_conversation
-- Opens the chat between a student and a mess. If the chat already exists
-- its id is returned, otherwise a new chat is created.
-- It uses INSERT ... ON DUPLICATE KEY UPDATE: the UNIQUE key (mess_id, student_id)
-- decides if the row exists, so two people clicking Chat at the same time
-- still end up with one conversation.
-- ====================================================================
USE mess_finder;

DROP PROCEDURE IF EXISTS sp_get_or_create_conversation;

DELIMITER $$
CREATE PROCEDURE sp_get_or_create_conversation (
    IN  p_mess_id          INT,
    IN  p_student_id       INT,
    OUT p_conversation_id  INT
)
BEGIN
    INSERT INTO conversations (mess_id, student_id)
    VALUES (p_mess_id, p_student_id)
    ON DUPLICATE KEY UPDATE conversation_id = LAST_INSERT_ID(conversation_id);

    -- LAST_INSERT_ID() is the new id, or the old id that was set in the UPDATE part above
    SET p_conversation_id = LAST_INSERT_ID();
END$$
DELIMITER ;
