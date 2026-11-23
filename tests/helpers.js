// Shared helpers for the tests. The tests talk to the real API and the real demo database,
// so load the demo data first (see database/README.md) and fill in your .env file.
const http = require('http');
const createApp = require('../src/app');
const { initChat } = require('../src/socket/chat');
const { pool, query } = require('../src/config/db');

const DEMO_PASSWORD = 'Demo@1234';

// Starts the API and the real time chat on a free port.
// base is the address of the API, url is the address for Socket.io.
async function startServer() {
    const server = http.createServer(createApp());
    const io = initChat(server);
    await new Promise((resolve) => server.listen(0, resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    return {
        base: `${url}/api`,
        url,
        close: () => new Promise((resolve) => io.close(() => resolve())),   // also closes the http server
    };
}

// Sends one request and returns { status, body }.
async function request(base, method, path, { token, body, rawBody } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined || rawBody !== undefined) headers['Content-Type'] = 'application/json';

    const response = await fetch(base + path, {
        method,
        headers,
        body: rawBody !== undefined ? rawBody : body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
}

// Logs a demo user in and returns the token.
async function loginAs(base, email, password = DEMO_PASSWORD) {
    const result = await request(base, 'POST', '/auth/login', { body: { email, password } });
    if (result.status !== 200) throw new Error(`Login failed for ${email}: ${result.status}`);
    return result.body.token;
}

// A number that is different on every run, used to make unique emails and phone numbers.
function uniqueNumber() {
    return Date.now() % 1e9;
}

// Removes a user the tests created (the profile first, because it points at the user).
async function deleteTestUser(userId) {
    await query('DELETE FROM student_profiles WHERE student_id = ?', [userId]);
    await query('DELETE FROM manager_profiles WHERE manager_id = ?', [userId]);
    await query('DELETE FROM users WHERE user_id = ?', [userId]);
}

async function closePool() {
    await pool.end();
}

// Creates a new student or manager account through the API and returns { token, user }.
// The caller must delete the user at the end (deleteTestUser).
async function registerUser(base, role) {
    const stamp = uniqueNumber() + Math.floor(Math.random() * 1000);
    const digits = String(stamp).padStart(8, '0').slice(-8);
    const body = {
        role,
        full_name: role === 'manager' ? 'Test Manager' : 'Test Student',
        email: `test.${role}.${stamp}@example.com`,
        phone: `013${role === 'manager' ? '5' : '4'}${digits.slice(0, 7)}`,
        password: 'Secret123',
    };
    if (role === 'manager') {
        body.nid_no = `19${digits}${digits.slice(0, 3)}`;
    } else {
        body.university_id = 1;
        body.gender = 'male';
    }
    const result = await request(base, 'POST', '/auth/register', { body });
    if (result.status !== 201) throw new Error('Could not register a test user: ' + JSON.stringify(result.body));
    return result.body;
}

// Tests that add rows (posts, comments, notifications, a test mess...) must leave the demo data
// as it was. takeSnapshot() remembers the last id of each table, restoreSnapshot() deletes
// everything added after that, in an order the foreign keys allow.
const TRACKED_TABLES = [
    ['messages', 'message_id'],
    ['conversations', 'conversation_id'],
    ['notifications', 'notification_id'],
    ['post_comments', 'comment_id'],
    ['vacancy_posts', 'post_id'],        // its post_seats rows are deleted with it (CASCADE)
    ['seat_wanted_posts', 'wanted_id'],
    ['reviews', 'review_id'],
    ['visit_requests', 'visit_id'],
    ['complaints', 'complaint_id'],
    ['payments', 'payment_id'],
    ['rent_dues', 'due_id'],
    ['mess_members', 'member_id'],       // a seat that was booked by a test must be set free again by that test
    ['seat_rent_log', 'log_id'],
    ['seats', 'seat_id'],
    ['rooms', 'room_id'],
    ['messes', 'mess_id'],               // its facility and university rows are deleted with it (CASCADE)
];

async function takeSnapshot() {
    const snapshot = {};
    for (const [table, idColumn] of TRACKED_TABLES) {
        const rows = await query(`SELECT COALESCE(MAX(${idColumn}), 0) AS last_id FROM ${table}`);
        snapshot[table] = rows[0].last_id;
    }
    return snapshot;
}

async function restoreSnapshot(snapshot) {
    for (const [table, idColumn] of TRACKED_TABLES) {
        await query(`DELETE FROM ${table} WHERE ${idColumn} > ?`, [snapshot[table]]);
    }
}

// Today by the clock of the database (the dues and the demo data use the same clock).
async function today() {
    const rows = await query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS day");
    return rows[0].day;
}

module.exports = {
    startServer, request, loginAs, registerUser, uniqueNumber, deleteTestUser, closePool, query,
    takeSnapshot, restoreSnapshot, today, DEMO_PASSWORD,
};
