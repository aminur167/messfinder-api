// Tests of the admin part: dashboard, reports, verification, users, complaints and moderation.
// Tests that change a demo row put it back at the end, so the demo data stays as it was.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
    startServer, request, loginAs, closePool, query, takeSnapshot, restoreSnapshot,
} = require('./helpers');

after(closePool);

describe('only the admin can use the admin API', () => {
    let api;
    before(async () => { api = await startServer(); });
    after(async () => { await api.close(); });

    it('refuses visitors, students and managers', async () => {
        const paths = ['/admin/dashboard', '/admin/reports', '/admin/pending', '/admin/users', '/admin/complaints', '/admin/posts', '/admin/comments'];
        const student = await loginAs(api.base, 'rafsan.jani@example.com');
        const manager = await loginAs(api.base, 'abdur.rahman@example.com');
        for (const path of paths) {
            assert.equal((await request(api.base, 'GET', path)).status, 401, path);
            assert.equal((await request(api.base, 'GET', path, { token: student })).status, 403, path);
            assert.equal((await request(api.base, 'GET', path, { token: manager })).status, 403, path);
        }
        assert.equal((await request(api.base, 'PATCH', '/admin/users/9/block', { token: manager })).status, 403);
    });
});

describe('dashboard and reports', () => {
    let api, admin;
    before(async () => {
        api = await startServer();
        admin = await loginAs(api.base, 'admin@example.com');
    });
    after(async () => { await api.close(); });

    it('shows the numbers of the dashboard', async () => {
        const result = await request(api.base, 'GET', '/admin/dashboard', { token: admin });
        assert.equal(result.status, 200);
        assert.equal(result.body.users.total, 31);
        assert.equal(result.body.users.students, 24);
        assert.equal(result.body.users.managers, 6);
        assert.equal(result.body.users.blocked, 1);
        assert.equal(result.body.messes.total, 6);
        assert.equal(result.body.messes.verified, 5);
        assert.equal(result.body.messes.pending, 1);
        assert.equal(result.body.open_complaints, 2);                 // one open and one in review
        assert.equal(result.body.pending_verifications, 2);           // manager Mizanur and his mess
        assert.equal(result.body.recent_pending.managers[0].full_name, 'Mizanur Rahman');
        assert.equal(result.body.recent_pending.messes[0].mess_name, 'Badda Student Home');
    });

    it('shows the reports', async () => {
        const result = await request(api.base, 'GET', '/admin/reports', { token: admin });
        assert.equal(result.status, 200);

        // areas: the busiest first, the area without a verified mess is still listed
        const areas = result.body.areas;
        assert.ok(areas.length >= 6);
        for (let i = 1; i < areas.length; i += 1) {
            assert.ok(areas[i - 1].verified_messes >= areas[i].verified_messes, 'areas must be sorted by verified messes');
        }
        assert.equal(areas.find((a) => a.area_name === 'Badda').verified_messes, 0);   // its only mess is pending

        // top rated: ranks start at 1, equal ratings share a rank, only verified messes
        const top = result.body.top_rated;
        assert.ok(top.length >= 1 && top.length <= 5 + 4);
        assert.equal(top[0].ranking, 1);
        assert.ok(!top.some((m) => m.mess_name === 'Badda Student Home'));
        for (let i = 1; i < top.length; i += 1) {
            assert.ok(top[i - 1].avg_rating >= top[i].avg_rating);
            assert.ok(top[i].ranking >= top[i - 1].ranking);
        }

        // the recursive CTE gives exactly 12 months, oldest first, each month once
        const months = result.body.new_members_per_month;
        assert.equal(months.length, 12);
        assert.deepEqual(months.map((m) => m.month), [...months.map((m) => m.month)].sort());
        assert.equal(new Set(months.map((m) => m.month)).size, 12);
        assert.ok(months.every((m) => m.new_members >= 0));
        const now = (await query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m') AS m"))[0].m;
        assert.equal(months[11].month, now);

        // the money side agrees with the database
        const money = result.body.money;
        const active = (await query("SELECT COUNT(*) AS n FROM mess_members WHERE status = 'active'"))[0].n;
        assert.equal(money.active_members, active);
        assert.ok(money.total_outstanding >= 0);
        assert.equal(money.overdue_dues, (await query('SELECT COUNT(*) AS n FROM v_overdue_dues'))[0].n);
    });
});

describe('verification of managers and messes', () => {
    let api, admin, snapshot;
    before(async () => {
        api = await startServer();
        snapshot = await takeSnapshot();
        admin = await loginAs(api.base, 'admin@example.com');
    });
    after(async () => {
        // back to the demo state: manager 7 not verified, mess 6 pending, mess 5 verified
        await query('UPDATE manager_profiles SET is_verified = 0 WHERE manager_id = 7');
        await query("UPDATE messes SET status = 'pending' WHERE mess_id = 6");
        await query("UPDATE messes SET status = 'verified' WHERE mess_id = 5");
        await restoreSnapshot(snapshot);
        await api.close();
    });

    it('lists what waits for the admin', async () => {
        const result = await request(api.base, 'GET', '/admin/pending', { token: admin });
        assert.equal(result.status, 200);
        assert.deepEqual(result.body.managers.data.map((m) => m.user_id), [7]);
        assert.equal(result.body.managers.data[0].mess_name, 'Badda Student Home');
        assert.deepEqual(result.body.messes.data.map((m) => m.mess_id), [6]);
        assert.equal(result.body.messes.data[0].manager_verified, 0);
        assert.ok(result.body.messes.data[0].seat_count > 0);
        assert.equal(result.body.managers.total, 1);
        assert.equal(result.body.messes.total_pages, 1);
    });

    it('a mess cannot be verified before its manager', async () => {
        const result = await request(api.base, 'PATCH', '/admin/messes/6/verify', { token: admin });
        assert.equal(result.status, 400);
        assert.match(result.body.error, /Verify the manager first/);
    });

    it('verifies the manager, tells him, and then the mess', async () => {
        const manager = await request(api.base, 'PATCH', '/admin/managers/7/verify', { token: admin });
        assert.equal(manager.status, 200);
        assert.equal((await query('SELECT is_verified FROM manager_profiles WHERE manager_id = 7'))[0].is_verified, 1);
        const note = await query("SELECT COUNT(*) AS n FROM notifications WHERE user_id = 7 AND message = 'Your manager account was verified.'");
        assert.equal(note[0].n, 1);
        assert.equal((await request(api.base, 'PATCH', '/admin/managers/7/verify', { token: admin })).status, 400);   // twice

        const mess = await request(api.base, 'PATCH', '/admin/messes/6/verify', { token: admin });
        assert.equal(mess.status, 200, JSON.stringify(mess.body));
        assert.equal(mess.body.status, 'verified');
        // the trigger of the database wrote the notification for the manager
        const trigger = await query("SELECT COUNT(*) AS n FROM notifications WHERE user_id = 7 AND message LIKE '%Badda Student Home%'");
        assert.ok(trigger[0].n >= 1);

        assert.equal((await request(api.base, 'PATCH', '/admin/messes/6/verify', { token: admin })).status, 400);     // twice
        const pending = await request(api.base, 'GET', '/admin/pending', { token: admin });
        assert.equal(pending.body.messes.total, 0);
        assert.equal(pending.body.managers.total, 0);

        // the public can see the mess now
        const publicList = await request(api.base, 'GET', '/messes/6');
        assert.equal(publicList.status, 200);
    });

    it('suspends a mess, and the public cannot see it any more', async () => {
        assert.equal((await request(api.base, 'GET', '/messes/5')).status, 200);
        const result = await request(api.base, 'PATCH', '/admin/messes/5/suspend', { token: admin });
        assert.equal(result.status, 200);
        assert.equal(result.body.status, 'suspended');
        assert.equal((await request(api.base, 'GET', '/messes/5')).status, 404);
        assert.equal((await request(api.base, 'PATCH', '/admin/messes/5/suspend', { token: admin })).status, 400);   // twice

        // it can be brought back
        assert.equal((await request(api.base, 'PATCH', '/admin/messes/5/verify', { token: admin })).status, 200);
        assert.equal((await request(api.base, 'GET', '/messes/5')).status, 200);
    });

    it('refuses unknown ids and wrong ids', async () => {
        assert.equal((await request(api.base, 'PATCH', '/admin/managers/9999/verify', { token: admin })).status, 404);
        assert.equal((await request(api.base, 'PATCH', '/admin/messes/9999/verify', { token: admin })).status, 404);
        assert.equal((await request(api.base, 'PATCH', '/admin/messes/abc/suspend', { token: admin })).status, 400);
        assert.equal((await request(api.base, 'PATCH', '/admin/managers/8/verify', { token: admin })).status, 404);   // a student
    });
});

describe('users: search, block and unblock', () => {
    let api, admin;
    before(async () => {
        api = await startServer();
        admin = await loginAs(api.base, 'admin@example.com');
    });
    after(async () => {
        await query('UPDATE users SET is_active = 1 WHERE user_id IN (9, 16)');   // the demo has only user 31 blocked
        await api.close();
    });

    it('lists the users with filters and pages', async () => {
        const all = await request(api.base, 'GET', '/admin/users?limit=100', { token: admin });
        assert.equal(all.body.total, 31);
        assert.equal(all.body.data.length, 31);
        assert.ok(all.body.data.every((u) => u.password_hash === undefined), 'never send the password hash');

        const managers = await request(api.base, 'GET', '/admin/users?role=manager', { token: admin });
        assert.equal(managers.body.total, 6);
        const blocked = await request(api.base, 'GET', '/admin/users?status=blocked', { token: admin });
        assert.deepEqual(blocked.body.data.map((u) => u.user_id), [31]);
        const search = await request(api.base, 'GET', '/admin/users?q=rafsan', { token: admin });
        assert.deepEqual(search.body.data.map((u) => u.email), ['rafsan.jani@example.com']);
        assert.equal((await request(api.base, 'GET', '/admin/users?q=%25', { token: admin })).body.total, 0);   // % is a letter here

        const page2 = await request(api.base, 'GET', '/admin/users?limit=10&page=2', { token: admin });
        assert.equal(page2.body.data.length, 10);
        assert.equal(page2.body.total_pages, 4);
        assert.equal((await request(api.base, 'GET', '/admin/users?role=king', { token: admin })).status, 400);
        assert.equal((await request(api.base, 'GET', '/admin/users?limit=500', { token: admin })).status, 400);
    });

    it('blocks a user: his old token stops working and he cannot log in; unblock brings him back', async () => {
        const token = await loginAs(api.base, 'sumon.ahmed@example.com');
        assert.equal((await request(api.base, 'GET', '/notifications', { token })).status, 200);

        const blocked = await request(api.base, 'PATCH', '/admin/users/9/block', { token: admin });
        assert.equal(blocked.status, 200);
        assert.equal(blocked.body.is_active, 0);
        assert.equal((await request(api.base, 'GET', '/notifications', { token })).status, 401);
        const login = await request(api.base, 'POST', '/auth/login', { body: { email: 'sumon.ahmed@example.com', password: 'Demo@1234' } });
        assert.notEqual(login.status, 200);
        assert.equal((await request(api.base, 'PATCH', '/admin/users/9/block', { token: admin })).status, 400);       // twice

        const unblocked = await request(api.base, 'PATCH', '/admin/users/9/unblock', { token: admin });
        assert.equal(unblocked.status, 200);
        assert.equal((await request(api.base, 'GET', '/notifications', { token })).status, 200);
        assert.equal((await request(api.base, 'PATCH', '/admin/users/9/unblock', { token: admin })).status, 400);     // not blocked
    });

    it('cannot block an admin, himself or a user that does not exist', async () => {
        assert.equal((await request(api.base, 'PATCH', '/admin/users/1/block', { token: admin })).status, 400);
        assert.equal((await request(api.base, 'PATCH', '/admin/users/9999/block', { token: admin })).status, 404);
        assert.equal((await request(api.base, 'PATCH', '/admin/users/abc/block', { token: admin })).status, 400);
        assert.equal((await query('SELECT is_active FROM users WHERE user_id = 1'))[0].is_active, 1);
    });
});

describe('complaints', () => {
    let api, admin, snapshot;
    before(async () => {
        api = await startServer();
        snapshot = await takeSnapshot();
        admin = await loginAs(api.base, 'admin@example.com');
    });
    after(async () => {
        // complaint 3 goes back to open, as in the demo data
        await query("UPDATE complaints SET status = 'open', admin_note = NULL, resolved_at = NULL WHERE complaint_id = 3");
        await restoreSnapshot(snapshot);
        await api.close();
    });

    it('lists the unfinished complaints first and filters by status', async () => {
        const all = await request(api.base, 'GET', '/admin/complaints', { token: admin });
        assert.equal(all.body.total, 4);
        assert.deepEqual(all.body.data.slice(0, 2).map((c) => c.status).sort(), ['in_review', 'open']);
        assert.ok(['resolved', 'dismissed'].includes(all.body.data[3].status));
        const first = all.body.data.find((c) => c.complaint_id === 3);
        assert.equal(first.complainant_name, 'Abdur Rahman');
        assert.equal(first.against_name, 'Sumon Ahmed');
        assert.equal(first.mess_name, 'Rahman Boys Mess');

        const open = await request(api.base, 'GET', '/admin/complaints?status=open', { token: admin });
        assert.deepEqual(open.body.data.map((c) => c.complaint_id), [3]);
        assert.equal((await request(api.base, 'GET', '/admin/complaints?status=lost', { token: admin })).status, 400);
    });

    it('moves a complaint to review and then resolves it with a note; the complainant is told', async () => {
        const review = await request(api.base, 'PATCH', '/admin/complaints/3', { token: admin, body: { status: 'in_review' } });
        assert.equal(review.status, 200, JSON.stringify(review.body));
        assert.equal(review.body.status, 'in_review');
        assert.equal(review.body.resolved_at, null);

        const resolved = await request(api.base, 'PATCH', '/admin/complaints/3', {
            token: admin, body: { status: 'resolved', admin_note: 'We talked to the member and the rent was paid.' },
        });
        assert.equal(resolved.status, 200);
        assert.equal(resolved.body.status, 'resolved');
        assert.equal(resolved.body.admin_note, 'We talked to the member and the rent was paid.');
        assert.ok(resolved.body.resolved_at, 'a finished complaint has a resolved time');
        const stamp = resolved.body.resolved_at;

        // a trigger wrote a notification for the manager who complained (user 2)
        const note = await query("SELECT COUNT(*) AS n FROM notifications WHERE user_id = 2 AND message LIKE '%Rent unpaid for two months%'");
        assert.ok(note[0].n >= 1);

        // changing only the note keeps the first resolved time
        const noteOnly = await request(api.base, 'PATCH', '/admin/complaints/3', { token: admin, body: { admin_note: 'Closed after payment.' } });
        assert.equal(noteOnly.body.status, 'resolved');
        assert.equal(noteOnly.body.resolved_at, stamp);

        // opening it again clears the resolved time (the CHECK rule of the table needs that)
        const reopened = await request(api.base, 'PATCH', '/admin/complaints/3', { token: admin, body: { status: 'open' } });
        assert.equal(reopened.body.status, 'open');
        assert.equal(reopened.body.resolved_at, null);
    });

    it('refuses wrong updates', async () => {
        assert.equal((await request(api.base, 'PATCH', '/admin/complaints/3', { token: admin, body: {} })).status, 400);
        assert.equal((await request(api.base, 'PATCH', '/admin/complaints/3', { token: admin, body: { status: 'lost' } })).status, 400);
        assert.equal((await request(api.base, 'PATCH', '/admin/complaints/3', { token: admin, body: { admin_note: 'x'.repeat(300) } })).status, 400);
        assert.equal((await request(api.base, 'PATCH', '/admin/complaints/9999', { token: admin, body: { status: 'resolved' } })).status, 404);
        assert.equal((await request(api.base, 'PATCH', '/admin/complaints/abc', { token: admin, body: { status: 'resolved' } })).status, 400);
    });
});

describe('moderation of posts and comments', () => {
    let api, admin, snapshot;
    before(async () => {
        api = await startServer();
        snapshot = await takeSnapshot();
        admin = await loginAs(api.base, 'admin@example.com');
    });
    after(async () => {
        await query("UPDATE vacancy_posts SET status = 'open' WHERE post_id = 4");
        await query("UPDATE seat_wanted_posts SET status = 'open' WHERE wanted_id = 5");
        await restoreSnapshot(snapshot);
        await api.close();
    });

    it('lists the posts of both kinds in every status', async () => {
        const vacancy = await request(api.base, 'GET', '/admin/posts', { token: admin });      // vacancy is the default
        assert.equal(vacancy.status, 200);
        assert.equal(vacancy.body.total, 6);
        assert.ok(vacancy.body.data.some((p) => p.status === 'expired') && vacancy.body.data.some((p) => p.status === 'closed'));
        assert.equal(vacancy.body.data[0].author_name.length > 0, true);

        const wanted = await request(api.base, 'GET', '/admin/posts?type=wanted', { token: admin });
        assert.equal(wanted.body.total, 5);
        const open = await request(api.base, 'GET', '/admin/posts?type=wanted&status=open', { token: admin });
        assert.ok(open.body.data.every((p) => p.status === 'open'));
        assert.equal(open.body.total, 4);

        assert.equal((await request(api.base, 'GET', '/admin/posts?type=other', { token: admin })).status, 400);
        assert.equal((await request(api.base, 'GET', '/admin/posts?status=deleted', { token: admin })).status, 400);
    });

    it('removes a post, and it leaves the public newsfeed', async () => {
        const before = await request(api.base, 'GET', '/newsfeed?limit=20');
        assert.ok(before.body.data.some((p) => p.post_id === 4 && p.post_type === 'vacancy'), 'post 4 is on the feed');

        const result = await request(api.base, 'PATCH', '/admin/posts/vacancy/4/remove', { token: admin });
        assert.equal(result.status, 200);
        assert.equal(result.body.status, 'removed');
        assert.equal((await query('SELECT COUNT(*) AS n FROM vacancy_posts WHERE post_id = 4'))[0].n, 1);   // hidden, not deleted

        const after = await request(api.base, 'GET', '/newsfeed?limit=20');
        assert.ok(!after.body.data.some((p) => p.post_id === 4 && p.post_type === 'vacancy'));
        assert.equal((await request(api.base, 'PATCH', '/admin/posts/vacancy/4/remove', { token: admin })).status, 400);   // twice

        const wanted = await request(api.base, 'PATCH', '/admin/posts/wanted/5/remove', { token: admin });
        assert.equal(wanted.status, 200);
        assert.equal((await query('SELECT status FROM seat_wanted_posts WHERE wanted_id = 5'))[0].status, 'removed');
    });

    it('refuses wrong posts', async () => {
        assert.equal((await request(api.base, 'PATCH', '/admin/posts/vacancy/9999/remove', { token: admin })).status, 404);
        assert.equal((await request(api.base, 'PATCH', '/admin/posts/news/1/remove', { token: admin })).status, 400);
        assert.equal((await request(api.base, 'PATCH', '/admin/posts/vacancy/abc/remove', { token: admin })).status, 400);
    });

    it('lists the newest comments with their post and the admin can remove one', async () => {
        const list = await request(api.base, 'GET', '/admin/comments?limit=100', { token: admin });
        assert.equal(list.status, 200);
        assert.equal(list.body.total, (await query('SELECT COUNT(*) AS n FROM post_comments WHERE is_deleted = 0'))[0].n);
        assert.ok(list.body.data.every((c) => ['vacancy', 'wanted'].includes(c.post_type) && c.post_title));
        const times = list.body.data.map((c) => c.created_at);
        assert.deepEqual(times, [...times].sort().reverse());

        const target = list.body.data[0].comment_id;
        const removed = await request(api.base, 'DELETE', `/comments/${target}`, { token: admin });
        assert.ok([200, 204].includes(removed.status), `status ${removed.status}`);
        const again = await request(api.base, 'GET', '/admin/comments?limit=100', { token: admin });
        assert.equal(again.body.total, list.body.total - 1);
        await query('UPDATE post_comments SET is_deleted = 0 WHERE comment_id = ?', [target]);   // demo data back
    });
});
