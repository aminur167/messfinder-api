// The real time chat with Socket.io.
//
// The website connects with its login token:   io(url, { auth: { token } })
// Every user joins a private room called "user:<id>", so a message reaches him wherever he is on the site
// (the open chat shows it, any other page can raise the unread badge).
//
// Events the website sends (each has an answer through the callback: { ok: true, ... } or { ok: false, error }):
//   send_message  { conversation_id, body }   save a message and push it to both people
//   mark_read     { conversation_id }          the user read the chat, tell the other person
// Events the server sends:
//   new_message   the message (to both people)
//   messages_read { conversation_id, reader_id }
const { Server } = require('socket.io');
const env = require('../config/env');
const { loadUserFromToken } = require('../middleware/auth');
const { toAppError } = require('../middleware/error-handler');
const AppError = require('../utils/app-error');
const check = require('../utils/validate');
const chatService = require('../utils/chat-service');

// At most this many messages from one connection in 10 seconds (a simple protection against spam)
const MAX_MESSAGES_PER_10_SECONDS = 20;

function userRoom(userId) {
    return `user:${userId}`;
}

// The answer for the website when something went wrong
function errorAnswer(error) {
    const appError = toAppError(error);
    if (!appError) console.error(error);
    return { ok: false, error: appError ? appError.message : 'Something went wrong on the server' };
}

function tooFast(socket) {
    const now = Date.now();
    const recent = (socket.data.sentAt || []).filter((time) => now - time < 10000);
    recent.push(now);
    socket.data.sentAt = recent;
    return recent.length > MAX_MESSAGES_PER_10_SECONDS;
}

function initChat(httpServer) {
    const io = new Server(httpServer, { cors: { origin: env.clientOrigins } });

    // nobody connects without a valid token
    io.use(async (socket, next) => {
        try {
            const user = await loadUserFromToken(socket.handshake.auth && socket.handshake.auth.token);
            if (!user || !['student', 'manager'].includes(user.role)) return next(new Error('Please log in'));
            socket.data.user = user;
            return next();
        } catch (error) {
            return next(new Error('Please log in'));
        }
    });

    io.on('connection', (socket) => {
        const user = socket.data.user;
        socket.join(userRoom(user.id));

        socket.on('send_message', async (payload, answer) => {
            const reply = typeof answer === 'function' ? answer : () => {};
            try {
                if (tooFast(socket)) throw new AppError(429, 'You are sending messages too fast');
                const conversationId = check.integer((payload || {}).conversation_id, 'Conversation');
                const chat = await chatService.getConversationFor(conversationId, user.id);
                const message = await chatService.saveMessage(conversationId, user.id, (payload || {}).body);

                // both people get the message (every browser tab of each of them)
                io.to(userRoom(user.id)).to(userRoom(chat.other_user_id)).emit('new_message', message);
                reply({ ok: true, message });
            } catch (error) {
                reply(errorAnswer(error));
            }
        });

        socket.on('mark_read', async (payload, answer) => {
            const reply = typeof answer === 'function' ? answer : () => {};
            try {
                const conversationId = check.integer((payload || {}).conversation_id, 'Conversation');
                const chat = await chatService.getConversationFor(conversationId, user.id);
                const marked = await chatService.markRead(conversationId, user.id);
                if (marked > 0) {
                    io.to(userRoom(chat.other_user_id)).emit('messages_read', { conversation_id: conversationId, reader_id: user.id });
                }
                reply({ ok: true, marked });
            } catch (error) {
                reply(errorAnswer(error));
            }
        });
    });

    return io;
}

module.exports = { initChat };
