// Tests of the Interested button and the lists around it.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, request, loginAs, closePool, query, takeSnapshot, restoreSnapshot } = require('./helpers');

after(closePool);

describe('Interested button', () => {
    let api, snapshot, rafiul;
    before(async () => {
        api = await startServer();
        snapshot = await takeSnapshot();
        rafiul = await loginAs(api.base, 'rafiul.islam@example.com');
    });
    after(async () => {
        await query('DELETE FROM interests WHERE student_id = 8');
        await restoreSnapshot(snapshot);
        await api.close();
    });

    it('needs a student', async () => {
        assert.equal((await request(api.base, 'POST', '/interests/toggle', { body: { mess_id: 1 } })).status, 401);
        const manager = await loginAs(api.base, 'abdur.rahman@example.com');
        assert.equal((await request(api.base, 'POST', '/interests/toggle', { token: manager, body: { mess_id: 1 } })).status, 403);
        assert.equal((await request(api.base, 'GET', '/interests/my', { token: manager })).status, 403);
    });

    it('the first press adds, the second press removes', async () => {
        const first = await request(api.base, 'POST', '/interests/toggle', { token: rafiul, body: { mess_id: 1 } });
        assert.equal(first.status, 200);
        assert.equal(first.body.is_interested, true);

        const list = await request(api.base, 'GET', '/interests/my', { token: rafiul });
        assert.deepEqual(list.body.map((m) => m.mess_id), [1]);
        assert.equal(list.body[0].mess_name, 'Rahman Boys Mess');
        assert.equal(list.body[0].conversation_id, null);       // no chat yet

        // the manager was told by a trigger
        const notes = await query("SELECT COUNT(*) AS n FROM notifications WHERE user_id = 2 AND message = 'Rafiul Islam is interested in Rahman Boys Mess.'");
        assert.equal(notes[0].n, 1);

        const second = await request(api.base, 'POST', '/interests/toggle', { token: rafiul, body: { mess_id: 1 } });
        assert.equal(second.body.is_interested, false);
        assert.deepEqual((await request(api.base, 'GET', '/interests/my', { token: rafiul })).body, []);
    });

    it('remembers the post the button was pressed on', async () => {
        await request(api.base, 'POST', '/interests/toggle', { token: rafiul, body: { mess_id: 2, post_id: 2 } });
        const rows = await query('SELECT post_id FROM interests WHERE student_id = 8 AND mess_id = 2');
        assert.equal(rows[0].post_id, 2);
        await request(api.base, 'POST', '/interests/toggle', { token: rafiul, body: { mess_id: 2 } });   // remove again
    });

    it('a post of another mess is refused', async () => {
        const result = await request(api.base, 'POST', '/interests/toggle', { token: rafiul, body: { mess_id: 2, post_id: 1 } });
        assert.equal(result.status, 400);
        assert.deepEqual((await request(api.base, 'GET', '/interests/my', { token: rafiul })).body, []);
    });

    it('a mess that is not verified is refused', async () => {
        const result = await request(api.base, 'POST', '/interests/toggle', { token: rafiul, body: { mess_id: 6 } });
        assert.equal(result.status, 400);
        assert.match(result.body.error, /verified/);
    });

    it('wrong input gives 400', async () => {
        for (const body of [{}, { mess_id: 'one' }, { mess_id: 1, post_id: 'x' }, { mess_id: 9999 }]) {
            assert.equal((await request(api.base, 'POST', '/interests/toggle', { token: rafiul, body })).status, 400, JSON.stringify(body));
        }
    });
});

describe('Interested lists', () => {
    let api;
    before(async () => { api = await startServer(); });
    after(async () => { await api.close(); });

    it('a student sees his messes with the chat that exists', async () => {
        const token = await loginAs(api.base, 'rafsan.jani@example.com');
        const result = await request(api.base, 'GET', '/interests/my', { token });
        assert.equal(result.body.length, 2);
        const byMess = Object.fromEntries(result.body.map((m) => [m.mess_id, m]));
        assert.equal(byMess[1].conversation_id, 1);
        assert.equal(byMess[2].conversation_id, 4);
        assert.equal(byMess[1].free_seats, 5);
        assert.ok(byMess[1].interested_at);
    });

    it('a manager sees the students who are interested in his mess', async () => {
        const token = await loginAs(api.base, 'abdur.rahman@example.com');
        const result = await request(api.base, 'GET', '/manager/interests', { token });
        assert.equal(result.status, 200);
        assert.equal(result.body.total, 2);
        const byName = Object.fromEntries(result.body.data.map((s) => [s.full_name, s]));
        assert.equal(byName['Mehedi Hasan'].university, 'DU');
        assert.equal(byName['Mehedi Hasan'].post_title, 'Seats available in Mirpur 10 boys mess');
        assert.equal(byName['Mehedi Hasan'].conversation_id, 5);
        assert.equal(byName['Mehedi Hasan'].phone, '01711000016');
        assert.equal(byName['Rafsan Jani'].gender, 'male');
    });

    it('a manager sees only his own mess', async () => {
        const token = await loginAs(api.base, 'kamal.hossain@example.com');
        const result = await request(api.base, 'GET', '/manager/interests', { token });
        assert.deepEqual(result.body.data.map((s) => s.full_name).sort(), ['Rafsan Jani', 'Tasnim Hossain']);
    });

    it('is split into pages', async () => {
        const token = await loginAs(api.base, 'abdur.rahman@example.com');
        const result = await request(api.base, 'GET', '/manager/interests?limit=1&page=2', { token });
        assert.equal(result.body.data.length, 1);
        assert.equal(result.body.total_pages, 2);
    });
});
