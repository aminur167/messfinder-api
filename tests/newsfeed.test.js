// Tests of the newsfeed, the seat wanted posts, the vacancy posts of the manager and the comments.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, request, loginAs, closePool, query, takeSnapshot, restoreSnapshot } = require('./helpers');

after(closePool);

describe('newsfeed', () => {
    let api;
    before(async () => { api = await startServer(); });
    after(async () => { await api.close(); });

    it('shows open and expired posts, newest first', async () => {
        const result = await request(api.base, 'GET', '/newsfeed');
        assert.equal(result.status, 200);
        // 5 vacancy posts (one expired, the closed one is hidden) and 4 seat wanted posts
        assert.equal(result.body.total, 9);
        assert.equal(result.body.data[0].post_type, 'seat_wanted');
        assert.equal(result.body.data[0].post_id, 3);
        assert.equal(result.body.data[1].post_type, 'vacancy');
        assert.equal(result.body.data[1].post_id, 4);
        const dates = result.body.data.map((post) => post.created_at);
        assert.deepEqual(dates, [...dates].sort().reverse());
    });

    it('a vacancy post comes with its seats and the numbers of its mess', async () => {
        const result = await request(api.base, 'GET', '/newsfeed?type=vacancy');
        const post = result.body.data.find((p) => p.post_id === 4);
        assert.equal(post.author_name, 'Shanti Girls Mess');
        assert.equal(post.comment_count, 2);          // the third comment is deleted
        assert.deepEqual(post.seats.map((s) => `${s.room_no}${s.seat_label}`), ['101C', '102C']);
        assert.equal(post.seats[0].monthly_rent, 4200);
        assert.equal(post.mess.avg_rating, 4.33);
        assert.equal(post.viewer.is_interested, false);
        assert.equal(post.viewer.is_mine, false);
    });

    it('a seat wanted post comes with the university of the student', async () => {
        const result = await request(api.base, 'GET', '/newsfeed?type=seat_wanted');
        const post = result.body.data.find((p) => p.post_id === 3);
        assert.equal(post.author_name, 'Mehedi Hasan');
        assert.equal(post.author_university, 'DU');
        assert.equal(post.preferred_university, 'DU');
        assert.equal(post.budget_min, 3000);
        assert.equal(post.budget_max, 3800);
        assert.equal(post.mess_type, 'boys');
    });

    it('filters', async () => {
        const ids = (result) => result.body.data.map((post) => `${post.post_type}:${post.post_id}`).sort();
        assert.equal((await request(api.base, 'GET', '/newsfeed?type=vacancy')).body.total, 5);
        assert.equal((await request(api.base, 'GET', '/newsfeed?type=seat_wanted')).body.total, 4);
        assert.equal((await request(api.base, 'GET', '/newsfeed?status=open')).body.total, 8);   // the expired post is left out
        assert.deepEqual(ids(await request(api.base, 'GET', '/newsfeed?area_id=8')), ['seat_wanted:1']);
        assert.equal((await request(api.base, 'GET', '/newsfeed?mess_type=girls')).body.total, 4);
    });

    it('splits into pages', async () => {
        const result = await request(api.base, 'GET', '/newsfeed?limit=4&page=3');
        assert.equal(result.body.data.length, 1);
        assert.equal(result.body.total_pages, 3);
    });

    it('wrong parameters give 400', async () => {
        for (const path of ['/newsfeed?type=news', '/newsfeed?status=all', '/newsfeed?limit=500', '/newsfeed?mess_type=x']) {
            assert.equal((await request(api.base, 'GET', path)).status, 400, path);
        }
    });

    it('tells a logged in user which posts are his and which mess he marked', async () => {
        const rafsan = await loginAs(api.base, 'rafsan.jani@example.com');
        const result = await request(api.base, 'GET', '/newsfeed', { token: rafsan });
        const mine = result.body.data.filter((p) => p.viewer.is_mine).map((p) => `${p.post_type}:${p.post_id}`);
        assert.deepEqual(mine, ['seat_wanted:1']);
        const vacancy1 = result.body.data.find((p) => p.post_type === 'vacancy' && p.post_id === 1);
        assert.equal(vacancy1.viewer.is_interested, true);

        const manager = await loginAs(api.base, 'shirin.akter@example.com');
        const forManager = await request(api.base, 'GET', '/newsfeed', { token: manager });
        assert.deepEqual(forManager.body.data.filter((p) => p.viewer.is_mine).map((p) => p.post_id), [4]);
    });
});

describe('seat wanted posts of a student', () => {
    let api, snapshot, token;
    const form = { title: 'Need a seat near BUET', description: 'Quiet student', area_id: 8, university_id: 1, budget_min: 3000, budget_max: 4000, mess_type: 'boys', needed_from: '2099-01-01' };
    before(async () => {
        api = await startServer();
        snapshot = await takeSnapshot();
        token = await loginAs(api.base, 'rafsan.jani@example.com');
    });
    after(async () => { await restoreSnapshot(snapshot); await api.close(); });

    it('only a student can make a post', async () => {
        assert.equal((await request(api.base, 'POST', '/seat-wanted', { body: form })).status, 401);
        const manager = await loginAs(api.base, 'abdur.rahman@example.com');
        assert.equal((await request(api.base, 'POST', '/seat-wanted', { token: manager, body: form })).status, 403);
    });

    it('refuses a wrong form', async () => {
        const bad = [
            [{ ...form, title: 'No' }, /Title/],
            [{ ...form, mess_type: 'any' }, /Mess type/],
            [{ ...form, budget_min: 5000, budget_max: 3000 }, /Minimum budget/],
            [{ ...form, needed_from: '2020-01-01' }, /past/],
            [{ ...form, needed_from: 'tomorrow' }, /date/],
            [{ ...form, needed_from: undefined }, /Needed from/],
        ];
        for (const [body, pattern] of bad) {
            const result = await request(api.base, 'POST', '/seat-wanted', { token, body });
            assert.equal(result.status, 400, JSON.stringify(result.body));
            assert.match(result.body.error, pattern);
        }
    });

    it('creates a post that shows in the newsfeed and in his own list', async () => {
        const result = await request(api.base, 'POST', '/seat-wanted', { token, body: form });
        assert.equal(result.status, 201);
        assert.equal(result.body.status, 'open');
        assert.equal(result.body.student_id, 8 + 20);   // Rafsan Jani is user 28

        const feed = await request(api.base, 'GET', '/newsfeed?type=seat_wanted', { token });
        assert.ok(feed.body.data.some((p) => p.post_id === result.body.wanted_id && p.viewer.is_mine));

        const mine = await request(api.base, 'GET', '/seat-wanted/my', { token });
        assert.ok(mine.body.some((p) => p.wanted_id === result.body.wanted_id));
    });

    it('a student can have only 5 open posts', async () => {
        // Rafsan already has 1 open post from the demo data and 1 from the test above
        for (let i = 0; i < 3; i += 1) {
            assert.equal((await request(api.base, 'POST', '/seat-wanted', { token, body: form })).status, 201);
        }
        const sixth = await request(api.base, 'POST', '/seat-wanted', { token, body: form });
        assert.equal(sixth.status, 400);
        assert.match(sixth.body.error, /at most 5/);
    });

    it('closes his own post, and only his own', async () => {
        const mine = await request(api.base, 'GET', '/seat-wanted/my', { token });
        const open = mine.body.find((p) => p.status === 'open' && p.wanted_id > snapshot.seat_wanted_posts);
        const closed = await request(api.base, 'PATCH', `/seat-wanted/${open.wanted_id}/close`, { token });
        assert.equal(closed.body.status, 'closed');
        assert.equal((await request(api.base, 'PATCH', `/seat-wanted/${open.wanted_id}/close`, { token })).status, 400);

        // a post of another student (post 3 belongs to Mehedi)
        assert.equal((await request(api.base, 'PATCH', '/seat-wanted/3/close', { token })).status, 404);
        // a closed post is not in the newsfeed
        const feed = await request(api.base, 'GET', '/newsfeed?type=seat_wanted', { token });
        assert.ok(!feed.body.data.some((p) => p.post_id === open.wanted_id));
    });
});

describe('vacancy posts of a manager', () => {
    let api, snapshot, token, postId;
    before(async () => {
        api = await startServer();
        snapshot = await takeSnapshot();
        token = await loginAs(api.base, 'kamal.hossain@example.com');   // Green Nest Mess (mess 2)
    });
    after(async () => { await restoreSnapshot(snapshot); await api.close(); });

    it('only a manager can make a vacancy post', async () => {
        const body = { title: 'Free seats', available_from: '2099-01-01', seat_ids: [19] };
        assert.equal((await request(api.base, 'POST', '/manager/posts', { body })).status, 401);
        const student = await loginAs(api.base, 'rafsan.jani@example.com');
        assert.equal((await request(api.base, 'POST', '/manager/posts', { token: student, body })).status, 403);
    });

    it('refuses a wrong form', async () => {
        const ok = { title: 'Free seats', available_from: '2099-01-01', seat_ids: [19] };
        const bad = [
            [{ ...ok, title: 'x' }, /Title/],
            [{ ...ok, available_from: 'soon' }, /date/],
            [{ ...ok, seat_ids: [] }, /at least one seat/],
            [{ ...ok, seat_ids: undefined }, /at least one seat/],
            [{ ...ok, seat_ids: ['a'] }, /Seats/],
        ];
        for (const [body, pattern] of bad) {
            const result = await request(api.base, 'POST', '/manager/posts', { token, body });
            assert.equal(result.status, 400, JSON.stringify(result.body));
            assert.match(result.body.error, pattern);
        }
    });

    it('the database rules stop a wrong seat', async () => {
        const make = (seat_ids) => request(api.base, 'POST', '/manager/posts', { token, body: { title: 'Test post', available_from: '2099-01-01', seat_ids } });
        const taken = await make([11]);          // seat 11 has a member
        assert.equal(taken.status, 400);
        assert.match(taken.body.error, /Only free seats/);
        const other = await make([5]);           // seat 5 belongs to another mess
        assert.equal(other.status, 400);
        assert.match(other.body.error, /another mess/);
        // nothing was saved by the failed tries
        assert.equal((await query('SELECT COUNT(*) AS n FROM vacancy_posts WHERE post_id > ?', [snapshot.vacancy_posts]))[0].n, 0);
    });

    it('an unverified mess cannot post', async () => {
        const pending = await loginAs(api.base, 'mizanur.rahman@example.com');
        const result = await request(api.base, 'POST', '/manager/posts', { token: pending, body: { title: 'Test post', available_from: '2099-01-01', seat_ids: [46] } });
        assert.equal(result.status, 400);
        assert.match(result.body.error, /verified/);
    });

    it('creates a post with two seats', async () => {
        const result = await request(api.base, 'POST', '/manager/posts', {
            token, body: { title: 'Two seats near DIU', description: 'Meals included', available_from: '2099-01-01', seat_ids: [19, 18] },
        });
        assert.equal(result.status, 201);
        assert.equal(result.body.status, 'open');
        assert.equal(result.body.title, 'Two seats near DIU');
        assert.deepEqual(result.body.seats.map((s) => `${s.room_no}${s.seat_label}`), ['2AC', '2BA']);
        postId = result.body.post_id;
    });

    it('the post is in the newsfeed and in the list of the manager', async () => {
        const feed = await request(api.base, 'GET', '/newsfeed?type=vacancy');
        assert.equal(feed.body.data[0].post_id, postId);     // the newest post is first
        const mine = await request(api.base, 'GET', '/manager/posts', { token });
        assert.ok(mine.body.data.some((p) => p.post_id === postId));
        assert.ok(mine.body.data.every((p) => p.mess_id === 2));
        assert.equal(mine.body.page, 1);
        assert.ok(mine.body.total >= 1);   // only posts of his own mess
    });

    it('closes the post, and a closed post leaves the newsfeed', async () => {
        const closed = await request(api.base, 'PATCH', `/manager/posts/${postId}/close`, { token });
        assert.equal(closed.body.status, 'closed');
        assert.equal((await request(api.base, 'PATCH', `/manager/posts/${postId}/close`, { token })).status, 400);
        const feed = await request(api.base, 'GET', '/newsfeed?type=vacancy');
        assert.ok(!feed.body.data.some((p) => p.post_id === postId));
    });

    it('a manager cannot close the post of another mess', async () => {
        assert.equal((await request(api.base, 'PATCH', '/manager/posts/4/close', { token })).status, 404);
    });
});

describe('comments', () => {
    let api, snapshot, rafsan, shirin, admin;
    before(async () => {
        api = await startServer();
        snapshot = await takeSnapshot();
        rafsan = await loginAs(api.base, 'rafsan.jani@example.com');
        shirin = await loginAs(api.base, 'shirin.akter@example.com');
        admin = await loginAs(api.base, 'admin@example.com');
    });
    after(async () => { await restoreSnapshot(snapshot); await api.close(); });

    it('anybody can read the comments, deleted ones are hidden', async () => {
        const result = await request(api.base, 'GET', '/posts/vacancy/4/comments');
        assert.equal(result.status, 200);
        assert.equal(result.body.length, 2);
        assert.deepEqual(result.body.map((c) => c.full_name), ['Anika Tabassum', 'Shirin Akter']);
        assert.equal(result.body[1].role, 'manager');
        assert.ok(result.body.every((c) => c.can_delete === false));
    });

    it('works for seat wanted posts too', async () => {
        const result = await request(api.base, 'GET', '/posts/wanted/3/comments');
        assert.equal(result.body.length, 1);
        assert.equal(result.body[0].full_name, 'Abdur Rahman');
    });

    it('a wrong post gives 404 or 400', async () => {
        assert.equal((await request(api.base, 'GET', '/posts/vacancy/9999/comments')).status, 404);
        assert.equal((await request(api.base, 'GET', '/posts/news/1/comments')).status, 400);
        assert.equal((await request(api.base, 'GET', '/posts/vacancy/abc/comments')).status, 400);
    });

    it('a comment needs a login and some text', async () => {
        assert.equal((await request(api.base, 'POST', '/posts/vacancy/4/comments', { body: { body: 'Hi' } })).status, 401);
        for (const body of [{}, { body: '' }, { body: '   ' }, { body: 'x'.repeat(501) }]) {
            assert.equal((await request(api.base, 'POST', '/posts/vacancy/4/comments', { token: rafsan, body })).status, 400);
        }
    });

    it('a student comments on a vacancy post and the manager is told', async () => {
        const result = await request(api.base, 'POST', '/posts/vacancy/4/comments', { token: rafsan, body: { body: 'Is there a seat for a December start?' } });
        assert.equal(result.status, 201);
        assert.equal(result.body.full_name, 'Rafsan Jani');
        assert.equal(result.body.can_delete, true);

        const list = await request(api.base, 'GET', '/posts/vacancy/4/comments', { token: rafsan });
        assert.equal(list.body.length, 3);
        assert.deepEqual(list.body.map((c) => c.can_delete), [false, false, true]);

        const notes = await query("SELECT COUNT(*) AS n FROM notifications WHERE user_id = 4 AND message = 'New comment on your post: Is there a seat for a December start?'");
        assert.equal(notes[0].n, 1);
    });

    it('a manager comments on a seat wanted post and the student is told', async () => {
        const result = await request(api.base, 'POST', '/posts/wanted/1/comments', { token: shirin, body: { body: 'We have a girls only mess, sorry.' } });
        assert.equal(result.status, 201);
        assert.equal(result.body.role, 'manager');
        const notes = await query("SELECT COUNT(*) AS n FROM notifications WHERE user_id = 28 AND message LIKE 'New comment on your post: We have a girls only mess%'");
        assert.equal(notes[0].n, 1);
    });

    it('commenting on your own post tells nobody', async () => {
        const before = (await query('SELECT COUNT(*) AS n FROM notifications'))[0].n;
        await request(api.base, 'POST', '/posts/vacancy/4/comments', { token: shirin, body: { body: 'We answer all questions here.' } });
        assert.equal((await query('SELECT COUNT(*) AS n FROM notifications'))[0].n, before);
    });

    it('comments are closed on an expired post', async () => {
        const result = await request(api.base, 'POST', '/posts/vacancy/5/comments', { token: rafsan, body: { body: 'Too late?' } });
        assert.equal(result.status, 400);
        assert.match(result.body.error, /closed/);
    });

    it('deletes only your own comment (the admin can delete any)', async () => {
        const mine = await request(api.base, 'POST', '/posts/vacancy/4/comments', { token: rafsan, body: { body: 'To be deleted' } });
        const id = mine.body.comment_id;

        // somebody else cannot
        assert.equal((await request(api.base, 'DELETE', `/comments/${id}`, { token: shirin })).status, 403);
        assert.equal((await request(api.base, 'DELETE', `/comments/${id}`)).status, 401);

        // the owner can: the row stays, only is_deleted changes
        assert.equal((await request(api.base, 'DELETE', `/comments/${id}`, { token: rafsan })).status, 200);
        assert.equal((await query('SELECT is_deleted FROM post_comments WHERE comment_id = ?', [id]))[0].is_deleted, 1);
        assert.equal((await request(api.base, 'DELETE', `/comments/${id}`, { token: rafsan })).status, 404);

        // the admin can delete the comment of somebody else
        const another = await request(api.base, 'POST', '/posts/vacancy/4/comments', { token: rafsan, body: { body: 'Admin will delete this' } });
        assert.equal((await request(api.base, 'DELETE', `/comments/${another.body.comment_id}`, { token: admin })).status, 200);

        const list = await request(api.base, 'GET', '/posts/vacancy/4/comments');
        assert.ok(!list.body.some((c) => c.body === 'To be deleted' || c.body === 'Admin will delete this'));
    });
});
