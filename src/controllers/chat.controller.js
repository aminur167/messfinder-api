// The chat through the normal API: open a chat, the inbox, the messages. Sending is also possible here
// (the website uses Socket.io for it, this is the fallback). See src/socket/chat.js for the real time part.
const { query, withConnection } = require('../config/db');
const AppError = require('../utils/app-error');
const check = require('../utils/validate');
const chatService = require('../utils/chat-service');

// The chat in the shape the page needs: who is on the other side
function describeChat(chat, viewerId) {
    const viewerIsStudent = chat.student_id === viewerId;
    return {
        conversation_id: chat.conversation_id,
        mess_id: chat.mess_id,
        mess_name: chat.mess_name,
        student_id: chat.student_id,
        student_name: chat.student_name,
        manager_id: chat.manager_id,
        other_user_id: chat.other_user_id,
        title: viewerIsStudent ? chat.mess_name : chat.student_name,
        subtitle: viewerIsStudent ? `Manager: ${chat.manager_name}` : `Student of ${chat.mess_name}`,
    };
}

// POST /api/conversations
//   student: { "mess_id": 4 }       starts (or finds) his chat with that mess
//   manager: { "student_id": 28 }   starts (or finds) a chat with a student, for his own mess
// The procedure sp_get_or_create_conversation makes sure there is only one chat per student and mess.
async function open(req, res) {
    const body = req.body || {};
    let messId;
    let studentId;

    if (req.user.role === 'student') {
        messId = check.integer(body.mess_id, 'Mess');
        studentId = req.user.id;
        const rows = await query("SELECT status FROM messes WHERE mess_id = ?", [messId]);
        if (rows.length === 0 || rows[0].status !== 'verified') throw new AppError(404, 'Mess not found');
    } else {
        studentId = check.integer(body.student_id, 'Student');
        const own = await query('SELECT mess_id, status FROM messes WHERE manager_id = ?', [req.user.id]);
        if (own.length === 0) throw new AppError(404, 'You have not created your mess yet');
        if (own[0].status !== 'verified') throw new AppError(400, 'Your mess must be verified before you can chat');
        messId = own[0].mess_id;
        const student = await query("SELECT user_id FROM users WHERE user_id = ? AND role = 'student' AND is_active = 1", [studentId]);
        if (student.length === 0) throw new AppError(404, 'Student not found');
    }

    const conversationId = await withConnection(async (connection) => {
        await connection.query('CALL sp_get_or_create_conversation(?, ?, @conversation_id)', [messId, studentId]);
        const [rows] = await connection.query('SELECT @conversation_id AS id');
        return rows[0].id;
    });

    const chat = await chatService.getConversationFor(conversationId, req.user.id);
    res.json(describeChat(chat, req.user.id));
}

// GET /api/conversations
// The inbox: every chat of the user, the one with the newest message first, with the unread count.
async function inbox(req, res) {
    const rows = await query(
        `SELECT c.conversation_id, c.mess_id, me.mess_name, me.manager_id, c.student_id,
                su.full_name AS student_name, un.short_name AS student_university,
                c.last_message_at, lm.body AS last_message, lm.sender_id AS last_sender_id,
                (SELECT COUNT(*) FROM messages AS m
                  WHERE m.conversation_id = c.conversation_id AND m.sender_id <> ? AND m.is_read = 0) AS unread_count
           FROM conversations AS c
           JOIN messes AS me ON me.mess_id = c.mess_id
           JOIN users AS su ON su.user_id = c.student_id
           JOIN student_profiles AS sp ON sp.student_id = c.student_id
           JOIN universities AS un ON un.university_id = sp.university_id
           LEFT JOIN messages AS lm ON lm.message_id = (SELECT MAX(m2.message_id) FROM messages AS m2
                                                         WHERE m2.conversation_id = c.conversation_id)
          WHERE c.student_id = ? OR me.manager_id = ?
          ORDER BY COALESCE(c.last_message_at, c.created_at) DESC, c.conversation_id DESC`,
        [req.user.id, req.user.id, req.user.id]
    );

    res.json(rows.map((row) => ({
        ...row,
        title: row.student_id === req.user.id ? row.mess_name : row.student_name,
        other_user_id: row.student_id === req.user.id ? row.manager_id : row.student_id,
    })));
}

// GET /api/conversations/unread-count   (the number for the Chat link in the menu)
async function unreadCount(req, res) {
    const rows = await query(
        `SELECT COUNT(*) AS unread
           FROM messages AS m
           JOIN conversations AS c ON c.conversation_id = m.conversation_id
           JOIN messes AS me ON me.mess_id = c.mess_id
          WHERE (c.student_id = ? OR me.manager_id = ?) AND m.sender_id <> ? AND m.is_read = 0`,
        [req.user.id, req.user.id, req.user.id]
    );
    res.json({ unread: rows[0].unread });
}

// GET /api/conversations/:id/messages?limit=30&before=120
// The newest messages first fetched, shown oldest first. "before" is the id of the oldest message
// the page already has: send it to load the earlier messages. has_more tells if there are more.
async function messages(req, res) {
    const conversationId = check.integer(req.params.id, 'Conversation id');
    const chat = await chatService.getConversationFor(conversationId, req.user.id);
    const limit = check.integer(req.query.limit, 'Limit', { fallback: 30, max: 100 });

    const params = [conversationId];
    let beforeCondition = '';
    if (req.query.before !== undefined) {
        beforeCondition = 'AND m.message_id < ?';
        params.push(check.integer(req.query.before, 'Before'));
    }

    // one more than asked, to know if there are earlier messages
    const rows = await query(
        `SELECT m.message_id, m.conversation_id, m.sender_id, u.full_name AS sender_name, m.body, m.is_read, m.sent_at
           FROM messages AS m
           JOIN users AS u ON u.user_id = m.sender_id
          WHERE m.conversation_id = ? ${beforeCondition}
          ORDER BY m.message_id DESC
          LIMIT ?`,
        [...params, limit + 1]
    );
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit).reverse();

    // the phone numbers of the mess are shown in the header (the user is logged in)
    const contact = await query('SELECT contact_phone, contact_whatsapp FROM messes WHERE mess_id = ?', [chat.mess_id]);

    res.json({
        conversation: { ...describeChat(chat, req.user.id), ...contact[0] },
        viewer_id: req.user.id,
        has_more: hasMore,
        messages: page,
    });
}

// POST /api/conversations/:id/messages   { "body": "Hello" }
async function send(req, res) {
    const conversationId = check.integer(req.params.id, 'Conversation id');
    await chatService.getConversationFor(conversationId, req.user.id);
    const message = await chatService.saveMessage(conversationId, req.user.id, (req.body || {}).body);
    res.status(201).json(message);
}

// PATCH /api/conversations/:id/read
async function read(req, res) {
    const conversationId = check.integer(req.params.id, 'Conversation id');
    await chatService.getConversationFor(conversationId, req.user.id);
    res.json({ marked: await chatService.markRead(conversationId, req.user.id) });
}

module.exports = { open, inbox, unreadCount, messages, send, read };
