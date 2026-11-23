// Tests of /api/health and /api/auth (register, login, me).
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, request, loginAs, uniqueNumber, deleteTestUser, closePool, query } = require('./helpers');

after(closePool);

describe('health and errors', () => {
    let api;
    before(async () => { api = await startServer(); });
    after(async () => { await api.close(); });

    it('health check answers ok', async () => {
        const result = await request(api.base, 'GET', '/health');
        assert.equal(result.status, 200);
        assert.equal(result.body.status, 'ok');
    });

    it('an unknown address gives 404', async () => {
        const result = await request(api.base, 'GET', '/nothing-here');
        assert.equal(result.status, 404);
    });

    it('a body that is not JSON gives 400', async () => {
        const result = await request(api.base, 'POST', '/auth/login', { rawBody: '{ not json' });
        assert.equal(result.status, 400);
    });
});

describe('register', () => {
    let api;
    const createdUserIds = [];
    const stamp = uniqueNumber();
    const studentBody = {
        role: 'student',
        full_name: 'Test Student',
        email: `test.student.${stamp}@example.com`,
        phone: `0139${String(stamp).padStart(7, '0').slice(-7)}`,
        password: 'Secret123',
        university_id: 3,
        gender: 'male',
        student_roll: '12345',
        department: 'CSE',
    };

    before(async () => { api = await startServer(); });
    after(async () => {
        for (const id of createdUserIds) await deleteTestUser(id);
        await api.close();
    });

    it('a student can register and gets a token', async () => {
        const result = await request(api.base, 'POST', '/auth/register', { body: studentBody });
        assert.equal(result.status, 201);
        assert.equal(typeof result.body.token, 'string');
        assert.equal(result.body.user.role, 'student');
        assert.equal(result.body.user.email, studentBody.email);
        assert.equal('password_hash' in result.body.user, false);
        createdUserIds.push(result.body.user.user_id);

        // the profile row was saved too
        const profile = await query('SELECT university_id, gender FROM student_profiles WHERE student_id = ?', [result.body.user.user_id]);
        assert.equal(profile[0].university_id, 3);
    });

    it('the password is saved as a hash, not as text', async () => {
        const rows = await query('SELECT password_hash FROM users WHERE email = ?', [studentBody.email]);
        assert.notEqual(rows[0].password_hash, studentBody.password);
        assert.match(rows[0].password_hash, /^\$2[aby]\$/);
    });

    it('the same email cannot register twice', async () => {
        const result = await request(api.base, 'POST', '/auth/register', { body: { ...studentBody, phone: '01399999999' } });
        assert.equal(result.status, 409);
        assert.match(result.body.error, /email/i);
    });

    it('the same phone cannot register twice', async () => {
        const result = await request(api.base, 'POST', '/auth/register', { body: { ...studentBody, email: `other.${stamp}@example.com` } });
        assert.equal(result.status, 409);
        assert.match(result.body.error, /phone/i);
    });

    it('a phone number with +88 is accepted and saved in the short form', async () => {
        const phone = `0138${String(stamp).padStart(7, '0').slice(-7)}`;
        const result = await request(api.base, 'POST', '/auth/register', {
            body: { ...studentBody, email: `plus88.${stamp}@example.com`, phone: `+88${phone}` },
        });
        assert.equal(result.status, 201);
        assert.equal(result.body.user.phone, phone);
        createdUserIds.push(result.body.user.user_id);
    });

    it('wrong input gives 400 with a message', async () => {
        const bad = [
            [{ ...studentBody, password: '12345678' }, /letter and a number/],
            [{ ...studentBody, password: 'short1' }, /8 to 72/],
            [{ ...studentBody, email: 'not-an-email' }, /Email/],
            [{ ...studentBody, phone: '12345' }, /Phone/],
            [{ ...studentBody, gender: 'robot' }, /Gender/],
            [{ ...studentBody, university_id: undefined }, /University/],
            [{ ...studentBody, role: 'admin' }, /Role/],
            [{ ...studentBody, full_name: 'A' }, /Full name/],
        ];
        for (const [body, pattern] of bad) {
            const result = await request(api.base, 'POST', '/auth/register', { body });
            assert.equal(result.status, 400, JSON.stringify(result.body));
            assert.match(result.body.error, pattern);
        }
    });

    it('a university that does not exist is refused', async () => {
        const result = await request(api.base, 'POST', '/auth/register', {
            body: { ...studentBody, email: `nouni.${stamp}@example.com`, phone: '01397777777', university_id: 9999 },
        });
        assert.equal(result.status, 400);
        // nothing was left behind: the user row was rolled back with the failed profile
        const rows = await query('SELECT user_id FROM users WHERE email = ?', [`nouni.${stamp}@example.com`]);
        assert.equal(rows.length, 0);
    });

    it('a student whose university is not in the list can add it when he registers', async () => {
        const name = `Test University ${stamp}`;
        const first = await request(api.base, 'POST', '/auth/register', {
            body: { ...studentBody, email: `newuni.a.${stamp}@example.com`, phone: '01391111111', university_id: undefined, new_university: { name, area_id: 1 } },
        });
        assert.equal(first.status, 201);
        createdUserIds.push(first.body.user.user_id);

        const saved = await query('SELECT university_id, short_name, area_id, latitude FROM universities WHERE name = ?', [name]);
        assert.equal(saved.length, 1);
        assert.equal(saved[0].area_id, 1);
        assert.ok(saved[0].short_name.length > 0 && saved[0].latitude !== null);

        // a second student with the same name uses the same university, no duplicate is made
        const second = await request(api.base, 'POST', '/auth/register', {
            body: { ...studentBody, email: `newuni.b.${stamp}@example.com`, phone: '01392222222', university_id: undefined, new_university: { name: name.toUpperCase(), area_id: 2 } },
        });
        assert.equal(second.status, 201);
        createdUserIds.push(second.body.user.user_id);
        assert.equal((await query('SELECT COUNT(*) AS n FROM universities WHERE name = ?', [name]))[0].n, 1);
        const profile = await query('SELECT university_id FROM student_profiles WHERE student_id = ?', [second.body.user.user_id]);
        assert.equal(profile[0].university_id, saved[0].university_id);

        // wrong input is refused and nothing is left behind
        const base = { ...studentBody, university_id: undefined };
        const shortName = await request(api.base, 'POST', '/auth/register', { body: { ...base, email: `newuni.c.${stamp}@example.com`, phone: '01393333333', new_university: { name: 'ab', area_id: 1 } } });
        assert.equal(shortName.status, 400);
        const badArea = await request(api.base, 'POST', '/auth/register', { body: { ...base, email: `newuni.d.${stamp}@example.com`, phone: '01394444444', new_university: { name: `Other University ${stamp}`, area_id: 9999 } } });
        assert.equal(badArea.status, 400);
        assert.equal((await query('SELECT COUNT(*) AS n FROM universities WHERE name = ?', [`Other University ${stamp}`]))[0].n, 0);
        assert.equal((await query('SELECT COUNT(*) AS n FROM users WHERE email = ?', [`newuni.d.${stamp}@example.com`]))[0].n, 0);

        await query('DELETE FROM student_profiles WHERE university_id = ?', [saved[0].university_id]);
        for (const id of createdUserIds.splice(-2)) await deleteTestUser(id);
        await query('DELETE FROM universities WHERE university_id = ?', [saved[0].university_id]);
    });

    it('a manager can register with an NID number', async () => {
        const body = {
            role: 'manager',
            full_name: 'Test Manager',
            email: `test.manager.${stamp}@example.com`,
            phone: `0137${String(stamp).padStart(7, '0').slice(-7)}`,
            password: 'Secret123',
            nid_no: `19${String(stamp).padStart(11, '0')}`,
            address: 'House 1, Road 1, Dhaka',
        };
        const result = await request(api.base, 'POST', '/auth/register', { body });
        assert.equal(result.status, 201);
        assert.equal(result.body.user.role, 'manager');
        createdUserIds.push(result.body.user.user_id);

        // the manager is not verified until the admin approves
        const profile = await query('SELECT is_verified FROM manager_profiles WHERE manager_id = ?', [result.body.user.user_id]);
        assert.equal(profile[0].is_verified, 0);

        // the same NID again
        const again = await request(api.base, 'POST', '/auth/register', {
            body: { ...body, email: `again.${stamp}@example.com`, phone: '01396666666' },
        });
        assert.equal(again.status, 409);
        assert.match(again.body.error, /NID/);
    });

    it('a bad NID number gives 400', async () => {
        const result = await request(api.base, 'POST', '/auth/register', {
            body: { role: 'manager', full_name: 'Bad Nid', email: `badnid.${stamp}@example.com`, phone: '01395555555', password: 'Secret123', nid_no: '12ab' },
        });
        assert.equal(result.status, 400);
        assert.match(result.body.error, /NID/);
    });
});

describe('login and me', () => {
    let api;
    before(async () => { api = await startServer(); });
    after(async () => { await api.close(); });

    it('a demo user can log in', async () => {
        const result = await request(api.base, 'POST', '/auth/login', {
            body: { email: 'rafiul.islam@example.com', password: 'Demo@1234' },
        });
        assert.equal(result.status, 200);
        assert.equal(typeof result.body.token, 'string');
        assert.equal(result.body.user.role, 'student');
        assert.equal('password_hash' in result.body.user, false);
    });

    it('the email is not case sensitive', async () => {
        const result = await request(api.base, 'POST', '/auth/login', {
            body: { email: 'Rafiul.Islam@Example.com', password: 'Demo@1234' },
        });
        assert.equal(result.status, 200);
    });

    it('a wrong password and an unknown email give the same answer', async () => {
        const wrongPassword = await request(api.base, 'POST', '/auth/login', {
            body: { email: 'rafiul.islam@example.com', password: 'Wrong-pass1' },
        });
        const unknownEmail = await request(api.base, 'POST', '/auth/login', {
            body: { email: 'nobody@example.com', password: 'Demo@1234' },
        });
        assert.equal(wrongPassword.status, 401);
        assert.equal(unknownEmail.status, 401);
        assert.equal(wrongPassword.body.error, unknownEmail.body.error);
    });

    it('a blocked account cannot log in', async () => {
        const result = await request(api.base, 'POST', '/auth/login', {
            body: { email: 'kabir.hossain@example.com', password: 'Demo@1234' },
        });
        assert.equal(result.status, 403);
    });

    it('missing fields give 400', async () => {
        const result = await request(api.base, 'POST', '/auth/login', { body: { email: 'rafiul.islam@example.com' } });
        assert.equal(result.status, 400);
    });

    it('me needs a token', async () => {
        assert.equal((await request(api.base, 'GET', '/auth/me')).status, 401);
        assert.equal((await request(api.base, 'GET', '/auth/me', { token: 'garbage' })).status, 401);
    });

    it('me of a student shows the university and the mess he lives in', async () => {
        const token = await loginAs(api.base, 'rafiul.islam@example.com');
        const result = await request(api.base, 'GET', '/auth/me', { token });
        assert.equal(result.status, 200);
        assert.equal(result.body.profile.university_short_name, 'BUET');
        assert.equal(result.body.membership.mess_name, 'Rahman Boys Mess');
    });

    it('me of a student who lives nowhere has no membership', async () => {
        const token = await loginAs(api.base, 'rafsan.jani@example.com');
        const result = await request(api.base, 'GET', '/auth/me', { token });
        assert.equal(result.body.membership, null);
    });

    it('me of a manager shows the mess and its status', async () => {
        const verified = await request(api.base, 'GET', '/auth/me', { token: await loginAs(api.base, 'abdur.rahman@example.com') });
        assert.equal(verified.body.mess.mess_id, 1);
        assert.equal(verified.body.mess.status, 'verified');
        assert.equal(verified.body.profile.is_verified, 1);

        const pending = await request(api.base, 'GET', '/auth/me', { token: await loginAs(api.base, 'mizanur.rahman@example.com') });
        assert.equal(pending.body.mess.status, 'pending');
        assert.equal(pending.body.profile.is_verified, 0);
    });

    it('a user who is blocked later loses the access at once', async () => {
        const stamp = uniqueNumber();
        const registered = await request(api.base, 'POST', '/auth/register', {
            body: {
                role: 'student', full_name: 'Soon Blocked', email: `blocked.${stamp}@example.com`,
                phone: `0136${String(stamp).padStart(7, '0').slice(-7)}`, password: 'Secret123', university_id: 1, gender: 'male',
            },
        });
        const { token, user } = registered.body;
        try {
            assert.equal((await request(api.base, 'GET', '/auth/me', { token })).status, 200);
            await query('UPDATE users SET is_active = 0 WHERE user_id = ?', [user.user_id]);
            assert.equal((await request(api.base, 'GET', '/auth/me', { token })).status, 401);
        } finally {
            await deleteTestUser(user.user_id);
        }
    });
});
