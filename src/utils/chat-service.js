// The chat rules in one place. The normal API (REST) and the real time part (Socket.io) both use it,
// so a message is checked and saved the same way whichever way it arrives.
const { query } = require('../config/db');
const AppError = require('./app-error');
const check = require('./validate');

// A chat is between one student and the manager of one mess.
// Returns the chat if the user is one of the two people, otherwise "not found"
// (we do not say that the chat exists).
async function getConversationFor(conversationId, userId) {
    const rows = await query(
        `SELECT c.conversation_id, c.mess_id, c.student_id, me.manager_id, me.mess_name,
                su.full_name AS student_name, mu.full_name AS manager_name
           FROM conversations AS c
           JOIN messes AS me ON me.mess_id = c.mess_id
           JOIN users AS su ON su.user_id = c.student_id
           JOIN users AS mu ON mu.user_id = me.manager_id
          WHERE c.conversation_id = ?`,
        [conversationId]
    );
    const chat = rows[0];
    if (!chat || (chat.student_id !== userId && chat.manager_id !== userId)) {
        throw new AppError(404, 'Conversation not found');
    }
    return { ...chat, other_user_id: chat.student_id === userId ? chat.manager_id : chat.student_id };
}

// Saves a message and returns it with the name of the sender.
// A trigger checks the sender again, updates the inbox order and notifies the other person.
async function saveMessage(conversationId, senderId, body) {
    const text = check.text(body, 'Message', { max: 1000 });

    const result = await query(
        'INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)',
        [conversationId, senderId, text]
    );
    const rows = await query(
        `SELECT m.message_id, m.conversation_id, m.sender_id, u.full_name AS sender_name, m.body, m.is_read, m.sent_at
           FROM messages AS m
           JOIN users AS u ON u.user_id = m.sender_id
          WHERE m.message_id = ?`,
        [result.insertId]
    );
    return rows[0];
}

// The user has read the chat: every message of the other person becomes "read".
// Returns how many messages changed.
async function markRead(conversationId, userId) {
    const result = await query(
        'UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND sender_id <> ? AND is_read = 0',
        [conversationId, userId]
    );
    return result.affectedRows;
}

module.exports = { getConversationFor, saveMessage, markRead };
