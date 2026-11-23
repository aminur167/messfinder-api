// Tests of the chat: the inbox and history, opening a chat, sending, and the real time part (Socket.io).
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { io } = require('socket.io-client');
const {
    startServer, request, loginAs, registerUser, deleteTestUser, closePool, query, takeSnapshot, restoreSnapshot,
} = require('./helpers');

after(closePool);

// ---------- helpers for Socket.io ----------

// Connects with a token. Resolves with the socket, or rejects with the reason the server gave.
function connect(url, token) {
    return new Promise((resolve, reject) => {
        const socket = io(url, { auth: { token }, transports: ['websocket'], reconnection: false });
        socket.on('connect', () => resolve(socket));
        socket.on('connect_error', (error) => { socket.close(); reject(error); });
    });
}

// Waits for one event. Gives up after the time (a missing event is a failed test, not a stuck test).
function waitFor(socket, event, ms = 3000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`No "${event}" event within ${ms} ms`)), ms);
        socket.once(event, (data) => { clearTimeout(timer); resolve(data); });
    });
}

// Resolves true if the event does NOT come in the given time.
function staysQuiet(socket, event, ms = 400) {
    return new Promise((resolve) => {
        let got = false;
        const listener = () => { got = true; };
        socket.on(event, listener);
        setTimeout(() => { socket.off(event, listener); resolve(!got); }, ms);
    });
}

// Sends an event and waits for the answer of the server.
function emit(socket, event, payload) {
    return new Promise((resolve) => socket.emit(event, payload, resolve));
}

describe('who can use the chat', () => {
    let api;
    before(async () => { api = await startServer(); });
    after(async () => { await api.close(); });

    it('needs a student or a manager', async () => {
        assert.equal((await request(api.base, 'GET', '/conversations')).status, 401);
        const admin = await loginAs(api.base, 'admin@example.com');
        assert.equal((await request(api.base, 'GET', '/conversations', { token: admin })).status, 403);
        assert.equal((await request(api.base, 'POST', '/conversations', { token: admin, body: { mess_id: 1 } })).status, 403);
    });
});

describe('the inbox and the history (demo data)', () => {
    let api, rafsan, mehedi, abdur, tasnim, jahid, kamal;
    before(async () => {
        api = await startServer();
        rafsan = await loginAs(api.base, 'rafsan.jani@example.com');
        mehedi = await loginAs(api.base, 'mehedi.hasan@example.com');
        abdur = await loginAs(api.base, 'abdur.rahman@example.com');
        tasnim = await loginAs(api.base, 'tasnim.hossain@example.com');
        jahid = await loginAs(api.base, 'jahid.hasan@example.com');
        kamal = await loginAs(api.base, 'kamal.hossain@example.com');
    });
    after(async () => { await api.close(); });

    it('a student sees his chats, the newest first, with the unread count', async () => {
        const result = await request(api.base, 'GET', '/conversations', { token: rafsan });
        assert.equal(result.status, 200);
        assert.deepEqual(result.body.map((c) => c.conversation_id), [1, 4]);
        assert.equal(result.body[0].title, 'Rahman Boys Mess');
        assert.equal(result.body[0].last_message, 'Confirmed. See you on Tuesday evening.');
        assert.equal(result.body[0].unread_count, 1);       // the last message of the manager is not read yet
        assert.equal(result.body[1].title, 'Green Nest Mess');
        assert.equal(result.body[1].unread_count, 0);
        assert.equal(result.body[0].other_user_id, 2);
    });

    it('a manager sees the students who wrote to him', async () => {
        const result = await request(api.base, 'GET', '/conversations', { token: abdur });
        assert.deepEqual(result.body.map((c) => c.title), ['Rafsan Jani', 'Mehedi Hasan']);
        assert.equal(result.body[0].student_university, 'DU');
        assert.equal(result.body[0].unread_count, 0);
        // another manager sees only his own chats
        assert.deepEqual((await request(api.base, 'GET', '/conversations', { token: kamal })).body.map((c) => c.conversation_id), [4]);
    });

    it('counts the unread messages for the menu badge', async () => {
        const count = async (token) => (await request(api.base, 'GET', '/conversations/unread-count', { token })).body.unread;
        assert.equal(await count(rafsan), 1);
        assert.equal(await count(mehedi), 1);
        assert.equal(await count(abdur), 0);
        assert.equal(await count(jahid), 1);     // Tasnim's last message is not read yet
        assert.equal(await count(tasnim), 0);
    });

    it('shows the messages oldest first, with the header of the chat', async () => {
        const result = await request(api.base, 'GET', '/conversations/1/messages', { token: rafsan });
        assert.equal(result.status, 200);
        assert.equal(result.body.messages.length, 6);
        assert.equal(result.body.has_more, false);
        assert.equal(result.body.viewer_id, 28);
        assert.equal(result.body.messages[0].body, 'Assalamu alaikum, is seat B in room 102 still free?');
        assert.equal(result.body.messages[0].sender_name, 'Rafsan Jani');
        const times = result.body.messages.map((m) => m.sent_at);
        assert.deepEqual(times, [...times].sort());

        assert.equal(result.body.conversation.title, 'Rahman Boys Mess');
        assert.equal(result.body.conversation.subtitle, 'Manager: Abdur Rahman');
        assert.equal(result.body.conversation.contact_phone, '8801811000002');

        // the manager sees the same chat from his side
        const manager = await request(api.base, 'GET', '/conversations/1/messages', { token: abdur });
        assert.equal(manager.body.conversation.title, 'Rafsan Jani');
        assert.equal(manager.body.conversation.subtitle, 'Student of Rahman Boys Mess');
    });

    it('loads earlier messages page by page', async () => {
        const latest = await request(api.base, 'GET', '/conversations/1/messages?limit=2', { token: rafsan });
        assert.equal(latest.body.messages.length, 2);
        assert.equal(latest.body.has_more, true);
        assert.equal(latest.body.messages[1].body, 'Confirmed. See you on Tuesday evening.');

        const oldestShown = latest.body.messages[0].message_id;
        const earlier = await request(api.base, 'GET', `/conversations/1/messages?limit=10&before=${oldestShown}`, { token: rafsan });
        assert.equal(earlier.body.messages.length, 4);
        assert.equal(earlier.body.has_more, false);
        assert.ok(earlier.body.messages.every((m) => m.message_id < oldestShown));
    });

    it('Bangla messages arrive unchanged', async () => {
        const anika = await loginAs(api.base, 'anika.tabassum@example.com');
        const result = await request(api.base, 'GET', '/conversations/3/messages', { token: anika });
        assert.equal(result.body.messages[0].body, 'আপনার মেসে কি এখনো সিট খালি আছে?');
    });

    it('only the two people of a chat can read it', async () => {
        assert.equal((await request(api.base, 'GET', '/conversations/1/messages', { token: tasnim })).status, 404);
        assert.equal((await request(api.base, 'GET', '/conversations/1/messages', { token: kamal })).status, 404);
        assert.equal((await request(api.base, 'GET', '/conversations/9999/messages', { token: rafsan })).status, 404);
        assert.equal((await request(api.base, 'GET', '/conversations/abc/messages', { token: rafsan })).status, 400);
        assert.equal((await request(api.base, 'GET', '/conversations/1/messages?limit=1000', { token: rafsan })).status, 400);
        assert.equal((await request(api.base, 'PATCH', '/conversations/1/read', { token: tasnim })).status, 404);
    });
});

describe('open a chat and send through the API', () => {
    let api, snapshot, rafiul, jahid, abdur, chatId, noMessManager;
    before(async () => {
        api = await startServer();
        snapshot = await takeSnapshot();
        rafiul = await loginAs(api.base, 'rafiul.islam@example.com');
        jahid = await loginAs(api.base, 'jahid.hasan@example.com');       // Campus Corner (mess 4)
        abdur = await loginAs(api.base, 'abdur.rahman@example.com');
        noMessManager = await registerUser(api.base, 'manager');
    });
    after(async () => {
        await restoreSnapshot(snapshot);
        await deleteTestUser(noMessManager.user.user_id);
        await api.close();
    });

    it('a student opens a chat with a mess, and opening it again finds the same chat', async () => {
        const first = await request(api.base, 'POST', '/conversations', { token: rafiul, body: { mess_id: 4 } });
        assert.equal(first.status, 200, JSON.stringify(first.body));
        assert.equal(first.body.title, 'Campus Corner');
        assert.equal(first.body.manager_id, 5);
        chatId = first.body.conversation_id;

        const again = await request(api.base, 'POST', '/conversations', { token: rafiul, body: { mess_id: 4 } });
        assert.equal(again.body.conversation_id, chatId);
        assert.equal((await query('SELECT COUNT(*) AS n FROM conversations WHERE mess_id = 4 AND student_id = 8'))[0].n, 1);
    });

    it('a new chat is in the inbox, before the first message', async () => {
        const inbox = await request(api.base, 'GET', '/conversations', { token: rafiul });
        const entry = inbox.body.find((c) => c.conversation_id === chatId);
        assert.equal(entry.last_message, null);
        assert.equal(entry.unread_count, 0);
        // the manager sees it too
        assert.ok((await request(api.base, 'GET', '/conversations', { token: jahid })).body.some((c) => c.conversation_id === chatId));
    });

    it('a mess that is not verified or does not exist cannot be chatted with', async () => {
        assert.equal((await request(api.base, 'POST', '/conversations', { token: rafiul, body: { mess_id: 6 } })).status, 404);
        assert.equal((await request(api.base, 'POST', '/conversations', { token: rafiul, body: { mess_id: 9999 } })).status, 404);
        assert.equal((await request(api.base, 'POST', '/conversations', { token: rafiul, body: {} })).status, 400);
    });

    it('a manager can start a chat with a student (for example after reading his seat wanted post)', async () => {
        const result = await request(api.base, 'POST', '/conversations', { token: abdur, body: { student_id: 8 } });
        assert.equal(result.status, 200, JSON.stringify(result.body));
        assert.equal(result.body.title, 'Rafiul Islam');
        assert.equal(result.body.mess_id, 1);

        const again = await request(api.base, 'POST', '/conversations', { token: abdur, body: { student_id: 8 } });
        assert.equal(again.body.conversation_id, result.body.conversation_id);

        assert.equal((await request(api.base, 'POST', '/conversations', { token: abdur, body: { student_id: 9999 } })).status, 404);
        assert.equal((await request(api.base, 'POST', '/conversations', { token: abdur, body: { student_id: 2 } })).status, 404);   // a manager, not a student
        assert.equal((await request(api.base, 'POST', '/conversations', { token: abdur, body: {} })).status, 400);
    });

    it('a manager without a verified mess cannot start a chat', async () => {
        const pending = await loginAs(api.base, 'mizanur.rahman@example.com');
        const result = await request(api.base, 'POST', '/conversations', { token: pending, body: { student_id: 8 } });
        assert.equal(result.status, 400);
        assert.match(result.body.error, /verified/);
        assert.equal((await request(api.base, 'POST', '/conversations', { token: noMessManager.token, body: { student_id: 8 } })).status, 404);
    });

    it('sends messages and refuses wrong ones', async () => {
        const send = (token, body, id = chatId) => request(api.base, 'POST', `/conversations/${id}/messages`, { token, body });
        const first = await send(rafiul, { body: 'Is a seat free in room 101?' });
        assert.equal(first.status, 201);
        assert.equal(first.body.sender_name, 'Rafiul Islam');
        assert.equal(first.body.is_read, 0);

        assert.equal((await send(rafiul, { body: '   ' })).status, 400);
        assert.equal((await send(rafiul, { body: 'x'.repeat(1001) })).status, 400);
        assert.equal((await send(rafiul, {})).status, 400);
        const tasnim = await loginAs(api.base, 'tasnim.hossain@example.com');
        assert.equal((await send(tasnim, { body: 'I am not in this chat' })).status, 404);
        assert.equal((await send(rafiul, { body: 'hello' }, 9999)).status, 404);
    });

    it('the chat updates the inbox order and tells the manager once', async () => {
        await request(api.base, 'POST', `/conversations/${chatId}/messages`, { token: rafiul, body: { body: 'A second message' } });

        const inbox = await request(api.base, 'GET', '/conversations', { token: jahid });
        assert.equal(inbox.body[0].conversation_id, chatId);                // the newest chat is on top
        assert.equal(inbox.body[0].last_message, 'A second message');
        assert.equal(inbox.body[0].unread_count, 2);

        const notes = await query("SELECT COUNT(*) AS n FROM notifications WHERE user_id = 5 AND is_read = 0 AND message = 'New message from Rafiul Islam.'");
        assert.equal(notes[0].n, 1);                                         // two messages, one notification
    });

    it('reading the chat marks the messages of the other person as read', async () => {
        const marked = await request(api.base, 'PATCH', `/conversations/${chatId}/read`, { token: jahid });
        assert.equal(marked.body.marked, 2);
        assert.equal((await request(api.base, 'PATCH', `/conversations/${chatId}/read`, { token: jahid })).body.marked, 0);
        assert.equal((await request(api.base, 'GET', '/conversations/unread-count', { token: jahid })).body.unread, 1);   // only the demo chat is left

        // his own messages stay unread for the student until the student's side reads
        await request(api.base, 'POST', `/conversations/${chatId}/messages`, { token: jahid, body: { body: 'Yes, room 101 has a seat.' } });
        assert.equal((await request(api.base, 'GET', '/conversations/unread-count', { token: rafiul })).body.unread, 1);
        await request(api.base, 'PATCH', `/conversations/${chatId}/read`, { token: rafiul });
        assert.equal((await request(api.base, 'GET', '/conversations/unread-count', { token: rafiul })).body.unread, 0);
    });
});

describe('real time chat with Socket.io', () => {
    let api, snapshot, rafiul, jahid, tasnim, chatId, sockets, outsider;
    before(async () => {
        api = await startServer();
        snapshot = await takeSnapshot();
        sockets = [];
        rafiul = await loginAs(api.base, 'rafiul.islam@example.com');
        jahid = await loginAs(api.base, 'jahid.hasan@example.com');
        tasnim = await loginAs(api.base, 'tasnim.hossain@example.com');
        chatId = (await request(api.base, 'POST', '/conversations', { token: rafiul, body: { mess_id: 4 } })).body.conversation_id;
        outsider = await registerUser(api.base, 'student');
    });
    after(async () => {
        sockets.forEach((socket) => socket.close());
        await restoreSnapshot(snapshot);
        await deleteTestUser(outsider.user.user_id);
        await api.close();
    });

    // connects and remembers the socket so it is closed at the end
    async function open(token) {
        const socket = await connect(api.url, token);
        sockets.push(socket);
        return socket;
    }

    it('does not let anybody in without a valid token', async () => {
        await assert.rejects(connect(api.url, undefined), /Please log in/);
        await assert.rejects(connect(api.url, 'garbage'), /Please log in/);
        const admin = await loginAs(api.base, 'admin@example.com');
        await assert.rejects(connect(api.url, admin), /Please log in/);
    });

    it('a message reaches both people at once, and is saved', async () => {
        const student = await open(rafiul);
        const manager = await open(jahid);
        const studentGets = waitFor(student, 'new_message');
        const managerGets = waitFor(manager, 'new_message');

        const answer = await emit(student, 'send_message', { conversation_id: chatId, body: 'Hello from the browser' });
        assert.equal(answer.ok, true);
        assert.equal(answer.message.body, 'Hello from the browser');

        const [forStudent, forManager] = await Promise.all([studentGets, managerGets]);
        assert.equal(forStudent.message_id, answer.message.message_id);
        assert.equal(forManager.message_id, answer.message.message_id);
        assert.equal(forManager.sender_name, 'Rafiul Islam');

        // saved by the same rules as the API: the row, the inbox order and the notification
        assert.equal((await query('SELECT body FROM messages WHERE message_id = ?', [answer.message.message_id]))[0].body, 'Hello from the browser');
        assert.ok((await query('SELECT last_message_at FROM conversations WHERE conversation_id = ?', [chatId]))[0].last_message_at);
        const notes = await query("SELECT COUNT(*) AS n FROM notifications WHERE user_id = 5 AND message = 'New message from Rafiul Islam.'");
        assert.equal(notes[0].n, 1);
    });

    it('the manager answers and the student gets it, but a stranger hears nothing', async () => {
        const student = await open(rafiul);
        const manager = await open(jahid);
        const stranger = await open(tasnim);       // a manager of another mess, connected at the same time
        const strangerQuiet = staysQuiet(stranger, 'new_message');
        const studentGets = waitFor(student, 'new_message');

        const answer = await emit(manager, 'send_message', { conversation_id: chatId, body: 'Welcome, come and see the room' });
        assert.equal(answer.ok, true);
        assert.equal((await studentGets).body, 'Welcome, come and see the room');
        assert.equal(await strangerQuiet, true);
    });

    it('every open tab of the sender gets his message too', async () => {
        const tab1 = await open(rafiul);
        const tab2 = await open(rafiul);
        const second = waitFor(tab2, 'new_message');
        const answer = await emit(tab1, 'send_message', { conversation_id: chatId, body: 'Sent from tab one' });
        assert.equal(answer.ok, true);
        assert.equal((await second).body, 'Sent from tab one');
    });

    it('Bangla text goes through', async () => {
        const student = await open(rafiul);
        const answer = await emit(student, 'send_message', { conversation_id: chatId, body: 'আমি কাল দেখতে আসব' });
        assert.equal(answer.ok, true);
        assert.equal((await query('SELECT body FROM messages WHERE message_id = ?', [answer.message.message_id]))[0].body, 'আমি কাল দেখতে আসব');
    });

    it('refuses wrong messages and saves nothing', async () => {
        const before = (await query('SELECT COUNT(*) AS n FROM messages'))[0].n;
        const student = await open(rafiul);
        const outside = await open(outsider.token);

        assert.match((await emit(outside, 'send_message', { conversation_id: chatId, body: 'I am not in this chat' })).error, /Conversation not found/);
        assert.match((await emit(student, 'send_message', { conversation_id: chatId, body: '   ' })).error, /Message is required/);
        assert.match((await emit(student, 'send_message', { conversation_id: chatId, body: 'x'.repeat(1001) })).error, /at most 1000/);
        assert.match((await emit(student, 'send_message', { conversation_id: 9999, body: 'hi' })).error, /not found/);
        assert.match((await emit(student, 'send_message', { body: 'no chat given' })).error, /Conversation/);
        assert.match((await emit(student, 'send_message', null)).error, /Conversation/);

        assert.equal((await query('SELECT COUNT(*) AS n FROM messages'))[0].n, before);
    });

    it('the other person is told when the chat is read', async () => {
        const student = await open(rafiul);
        const manager = await open(jahid);
        await emit(student, 'send_message', { conversation_id: chatId, body: 'Please read this' });

        const told = waitFor(student, 'messages_read');
        const answer = await emit(manager, 'mark_read', { conversation_id: chatId });
        assert.equal(answer.ok, true);
        assert.ok(answer.marked >= 1);
        assert.equal((await told).reader_id, 5);

        // nothing new to read: no event
        const quiet = staysQuiet(student, 'messages_read');
        assert.equal((await emit(manager, 'mark_read', { conversation_id: chatId })).marked, 0);
        assert.equal(await quiet, true);
        assert.equal((await emit(await open(outsider.token), 'mark_read', { conversation_id: chatId })).ok, false);
    });

    it('a connection cannot send too fast', async () => {
        const student = await open(rafiul);
        const answers = [];
        for (let i = 0; i < 24; i += 1) {
            answers.push(await emit(student, 'send_message', { conversation_id: chatId, body: `Message ${i}` }));
        }
        assert.ok(answers.slice(0, 5).every((a) => a.ok));
        const refused = answers.filter((a) => !a.ok);
        assert.ok(refused.length >= 3, 'some messages must be refused');
        assert.match(refused[0].error, /too fast/);
    });

    it('a blocked user cannot connect any more', async () => {
        const first = await open(outsider.token);
        assert.ok(first.connected);
        await query('UPDATE users SET is_active = 0 WHERE user_id = ?', [outsider.user.user_id]);
        await assert.rejects(connect(api.url, outsider.token), /Please log in/);
    });
});
