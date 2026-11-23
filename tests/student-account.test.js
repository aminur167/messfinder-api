// Tests of the student's own pages (My mess), reviews, visit requests, complaints,
// notifications and the profile.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
    startServer, request, loginAs, registerUser, deleteTestUser, closePool, query, takeSnapshot, restoreSnapshot,
} = require('./helpers');

after(closePool);

describe('My mess of a student', () => {
    let api;
    before(async () => { api = await startServer(); });
    after(async () => { await api.close(); });

    it('needs a student', async () => {
        assert.equal((await request(api.base, 'GET', '/me/membership')).status, 401);
        const manager = await loginAs(api.base, 'abdur.rahman@example.com');
        assert.equal((await request(api.base, 'GET', '/me/dues', { token: manager })).status, 403);
    });

    it('shows the mess, the rent month by month and the payments', async () => {
        const token = await loginAs(api.base, 'rafiul.islam@example.com');   // lives in Rahman Boys Mess since February

        const membership = await request(api.base, 'GET', '/me/membership', { token });
        assert.equal(membership.body.membership.mess_name, 'Rahman Boys Mess');
        assert.equal(membership.body.membership.room_no, '101');
        assert.equal(membership.body.membership.contact_phone, '8801811000002');

        const dues = await request(api.base, 'GET', '/me/dues', { token });
        assert.equal(dues.body.dues.length, 10);                 // February to November
        assert.equal(dues.body.outstanding, 0);
        assert.ok(dues.body.dues.every((d) => d.status === 'paid' && d.remaining === 0));
        assert.equal(dues.body.dues[0].due_month > dues.body.dues[1].due_month, true);   // newest first
        const view = await query('SELECT current_month_status AS s FROM v_member_dues WHERE member_id = 1');
        assert.equal(dues.body.current_month_status, view[0].s);

        const payments = await request(api.base, 'GET', '/me/payments', { token });
        const expected = await query('SELECT COUNT(*) AS n FROM payments WHERE member_id = 1');
        assert.equal(payments.body.length, expected[0].n);
    });

    it('a student who owes rent sees what he owes', async () => {
        const token = await loginAs(api.base, 'sumon.ahmed@example.com');
        const dues = await request(api.base, 'GET', '/me/dues', { token });
        assert.equal(dues.body.outstanding, 6000);
        assert.equal(dues.body.dues.filter((d) => d.status === 'overdue').length, 2);
    });

    it('a student who lives nowhere gets empty answers', async () => {
        const token = await loginAs(api.base, 'rafsan.jani@example.com');
        assert.deepEqual((await request(api.base, 'GET', '/me/membership', { token })).body, { membership: null });
        const dues = await request(api.base, 'GET', '/me/dues', { token });
        assert.deepEqual(dues.body, { membership: null, dues: [], outstanding: 0, current_month_status: null });
        assert.deepEqual((await request(api.base, 'GET', '/me/payments', { token })).body, []);
    });

    it('an ex-member still sees his old payments', async () => {
        const token = await loginAs(api.base, 'mehedi.hasan@example.com');   // left in July
        assert.deepEqual((await request(api.base, 'GET', '/me/membership', { token })).body, { membership: null });
        assert.equal((await request(api.base, 'GET', '/me/payments', { token })).body.length, 8);   // advance and 7 months
    });
});

describe('reviews and replies', () => {
    let api, snapshot, nayeem, rafsan, abdur, kamal, reviewId;
    before(async () => {
        api = await startServer();
        snapshot = await takeSnapshot();
        nayeem = await loginAs(api.base, 'nayeem.uddin@example.com');    // lives in mess 1, no review yet
        rafsan = await loginAs(api.base, 'rafsan.jani@example.com');
        abdur = await loginAs(api.base, 'abdur.rahman@example.com');
        kamal = await loginAs(api.base, 'kamal.hossain@example.com');
    });
    after(async () => { await restoreSnapshot(snapshot); await api.close(); });

    it('only a member of the mess can write a review', async () => {
        const result = await request(api.base, 'POST', '/reviews', { token: rafsan, body: { mess_id: 1, rating: 5 } });
        assert.equal(result.status, 400);
        assert.match(result.body.error, /Only current or past members/);
        assert.equal((await request(api.base, 'POST', '/reviews', { body: { mess_id: 1, rating: 5 } })).status, 401);
        assert.equal((await request(api.base, 'POST', '/reviews', { token: abdur, body: { mess_id: 1, rating: 5 } })).status, 403);
    });

    it('refuses wrong ratings', async () => {
        for (const body of [{ mess_id: 1 }, { mess_id: 1, rating: 6 }, { mess_id: 1, rating: 0 }, { mess_id: 1, rating: 4, food_rating: 9 },
                            { mess_id: 1, rating: 4, comment: 'x'.repeat(501) }, { rating: 4 }]) {
            assert.equal((await request(api.base, 'POST', '/reviews', { token: nayeem, body })).status, 400, JSON.stringify(body));
        }
    });

    it('a member writes a review and the manager is told', async () => {
        const result = await request(api.base, 'POST', '/reviews', {
            token: nayeem,
            body: { mess_id: 1, rating: 4, cleanliness_rating: 5, safety_rating: 4, comment: 'Good rooms, strong wifi.' },
        });
        assert.equal(result.status, 201, JSON.stringify(result.body));
        assert.equal(result.body.food_rating, null);
        reviewId = result.body.review_id;

        const notes = await query("SELECT COUNT(*) AS n FROM notifications WHERE user_id = 2 AND message = 'New review from Nayeem Uddin: 4 out of 5.'");
        assert.equal(notes[0].n, 1);

        // the Mess details page now says he cannot review again
        const page = await request(api.base, 'GET', '/messes/1', { token: nayeem });
        assert.equal(page.body.viewer.has_reviewed, true);
        assert.equal(page.body.viewer.can_review, false);
        assert.equal(page.body.ratings.review_count, 4);
    });

    it('one review per student and mess', async () => {
        const result = await request(api.base, 'POST', '/reviews', { token: nayeem, body: { mess_id: 1, rating: 5 } });
        assert.equal(result.status, 409);
        assert.match(result.body.error, /already reviewed/);
    });

    it('the manager sees the reviews and replies once', async () => {
        const list = await request(api.base, 'GET', '/manager/reviews', { token: abdur });
        assert.equal(list.body.total, 4);
        assert.equal(list.body.summary.review_count, 4);
        const review = list.body.data.find((r) => r.review_id === reviewId);
        assert.equal(review.reviewer_name, 'Nayeem Uddin');
        assert.equal(review.reviewer_type, 'Current member');
        assert.equal(review.manager_reply, null);

        const reply = await request(api.base, 'PATCH', `/manager/reviews/${reviewId}/reply`, { token: abdur, body: { reply: 'Thank you Nayeem!' } });
        assert.equal(reply.status, 200);
        assert.equal(reply.body.manager_reply, 'Thank you Nayeem!');
        assert.ok(reply.body.replied_at);

        // the public page shows the reply
        const pub = await request(api.base, 'GET', '/messes/1/reviews');
        assert.equal(pub.body.data.find((r) => r.review_id === reviewId).manager_reply, 'Thank you Nayeem!');

        assert.equal((await request(api.base, 'PATCH', `/manager/reviews/${reviewId}/reply`, { token: abdur, body: { reply: 'Again' } })).status, 409);
    });

    it('a manager cannot reply to the reviews of another mess, and the reply needs text', async () => {
        assert.equal((await request(api.base, 'PATCH', `/manager/reviews/${reviewId}/reply`, { token: kamal, body: { reply: 'Not mine' } })).status, 404);
        assert.equal((await request(api.base, 'PATCH', '/manager/reviews/1/reply', { token: abdur, body: { reply: '' } })).status, 400);
        assert.equal((await request(api.base, 'PATCH', '/manager/reviews/9999/reply', { token: abdur, body: { reply: 'Hi' } })).status, 404);
    });
});

describe('visit requests', () => {
    let api, snapshot, rafsan, tasnim, jahid, abdur, visitId, otherVisitId;
    before(async () => {
        api = await startServer();
        snapshot = await takeSnapshot();
        rafsan = await loginAs(api.base, 'rafsan.jani@example.com');
        tasnim = await loginAs(api.base, 'tasnim.hossain@example.com');
        jahid = await loginAs(api.base, 'jahid.hasan@example.com');      // Campus Corner (mess 4)
        abdur = await loginAs(api.base, 'abdur.rahman@example.com');
    });
    after(async () => { await restoreSnapshot(snapshot); await api.close(); });

    it('refuses wrong requests', async () => {
        const send = (body, token = rafsan) => request(api.base, 'POST', '/visits', { token, body });
        assert.match((await send({ mess_id: 4, visit_time: 'tomorrow' })).body.error, /Visit time/);
        assert.match((await send({ mess_id: 4, visit_time: '2099-13-40 10:00' })).body.error, /Visit time|date/);
        assert.match((await send({ mess_id: 4, visit_time: '2020-01-01 10:00' })).body.error, /future/);
        assert.match((await send({ mess_id: 6, visit_time: '2099-01-01 10:00' })).body.error, /verified/);
        assert.equal((await send({ visit_time: '2099-01-01 10:00' })).status, 400);
        assert.equal((await send({ mess_id: 4, visit_time: '2099-01-01 10:00' }, jahid)).status, 403);
        assert.equal((await request(api.base, 'POST', '/visits', { body: { mess_id: 4, visit_time: '2099-01-01 10:00' } })).status, 401);
    });

    it('a student asks for a visit and the manager is told', async () => {
        const result = await request(api.base, 'POST', '/visits', { token: rafsan, body: { mess_id: 4, visit_time: '2099-01-01T10:30', student_note: 'With a friend' } });
        assert.equal(result.status, 201, JSON.stringify(result.body));
        assert.equal(result.body.status, 'pending');
        assert.equal(result.body.visit_time, '2099-01-01 10:30:00');
        visitId = result.body.visit_id;

        const notes = await query("SELECT COUNT(*) AS n FROM notifications WHERE user_id = 5 AND message LIKE 'Rafsan Jani requested a visit on%'");
        assert.equal(notes[0].n, 1);

        const mine = await request(api.base, 'GET', '/visits/my', { token: rafsan });
        const entry = mine.body.find((v) => v.visit_id === visitId);
        assert.equal(entry.mess_name, 'Campus Corner');
        assert.equal(entry.can_cancel, 1);
    });

    it('the manager sees the request with the student', async () => {
        const list = await request(api.base, 'GET', '/manager/visits?status=pending', { token: jahid });
        const entry = list.body.data.find((v) => v.visit_id === visitId);
        assert.equal(entry.full_name, 'Rafsan Jani');
        assert.equal(entry.university, 'DU');
        assert.equal(entry.student_note, 'With a friend');
        // pending requests come first
        const all = await request(api.base, 'GET', '/manager/visits', { token: jahid });
        assert.equal(all.body.data[0].status, 'pending');
        assert.ok(all.body.counts.pending >= 1);
        assert.equal(all.body.counts.all, all.body.total);
        assert.equal(all.body.page, 1);
        assert.equal((await request(api.base, 'GET', '/manager/visits?status=maybe', { token: jahid })).status, 400);
        // another manager does not see it
        assert.ok(!(await request(api.base, 'GET', '/manager/visits', { token: abdur })).body.data.some((v) => v.visit_id === visitId));
    });

    it('confirms, completes, and the rules about the order', async () => {
        assert.equal((await request(api.base, 'PATCH', `/manager/visits/${visitId}/confirm`, { token: abdur })).status, 404);   // not his mess
        assert.match((await request(api.base, 'PATCH', `/manager/visits/${visitId}/complete`, { token: jahid })).body.error, /confirmed visit request can be completed|Only a confirmed/);

        const confirmed = await request(api.base, 'PATCH', `/manager/visits/${visitId}/confirm`, { token: jahid });
        assert.equal(confirmed.body.status, 'confirmed');
        const notes = await query("SELECT COUNT(*) AS n FROM notifications WHERE user_id = 28 AND message LIKE 'Your visit to Campus Corner was confirmed%'");
        assert.equal(notes[0].n, 1);

        assert.equal((await request(api.base, 'PATCH', `/manager/visits/${visitId}/confirm`, { token: jahid })).status, 400);
        assert.equal((await request(api.base, 'PATCH', `/manager/visits/${visitId}/reject`, { token: jahid })).status, 400);
        assert.equal((await request(api.base, 'PATCH', `/manager/visits/${visitId}/complete`, { token: jahid })).body.status, 'completed');
        assert.equal((await request(api.base, 'PATCH', '/manager/visits/9999/confirm', { token: jahid })).status, 404);
    });

    it('rejects a request, and the student is told', async () => {
        const created = await request(api.base, 'POST', '/visits', { token: tasnim, body: { mess_id: 4, visit_time: '2099-02-01 09:00' } });
        otherVisitId = created.body.visit_id;
        const rejected = await request(api.base, 'PATCH', `/manager/visits/${otherVisitId}/reject`, { token: jahid });
        assert.equal(rejected.body.status, 'rejected');
        const notes = await query("SELECT COUNT(*) AS n FROM notifications WHERE user_id = 30 AND message LIKE 'Your visit to Campus Corner was rejected%'");
        assert.equal(notes[0].n, 1);
    });

    it('a student cancels only his own open request', async () => {
        const created = await request(api.base, 'POST', '/visits', { token: rafsan, body: { mess_id: 1, visit_time: '2099-03-01 09:00' } });
        const id = created.body.visit_id;

        assert.equal((await request(api.base, 'PATCH', `/visits/${id}/cancel`, { token: tasnim })).status, 404);   // not his
        assert.equal((await request(api.base, 'PATCH', `/visits/${id}/cancel`, { token: rafsan })).body.status, 'cancelled');
        assert.equal((await request(api.base, 'PATCH', `/visits/${id}/cancel`, { token: rafsan })).status, 400);
        assert.equal((await request(api.base, 'PATCH', `/visits/${visitId}/cancel`, { token: rafsan })).status, 400);   // completed already
        assert.equal((await request(api.base, 'PATCH', '/visits/9999/cancel', { token: rafsan })).status, 404);
    });
});

describe('complaints', () => {
    let api, snapshot, rafsan, abdur, admin;
    before(async () => {
        api = await startServer();
        snapshot = await takeSnapshot();
        rafsan = await loginAs(api.base, 'rafsan.jani@example.com');
        abdur = await loginAs(api.base, 'abdur.rahman@example.com');
        admin = await loginAs(api.base, 'admin@example.com');
    });
    after(async () => { await restoreSnapshot(snapshot); await api.close(); });

    it('refuses wrong complaints', async () => {
        const send = (body, token = rafsan) => request(api.base, 'POST', '/complaints', { token, body });
        assert.match((await send({ subject: 'Hi', description: 'About the mess', mess_id: 1 })).body.error, /Subject/);
        assert.match((await send({ subject: 'Dirty rooms', description: 'ok' })).body.error, /Description/);
        assert.match((await send({ subject: 'Dirty rooms', description: 'The rooms are dirty' })).body.error, /Choose a mess or a user/);
        assert.match((await send({ subject: 'Dirty rooms', description: 'The rooms are dirty', against_user_id: 28 })).body.error, /yourself/);
        assert.equal((await send({ subject: 'Dirty rooms', description: 'The rooms are dirty', mess_id: 9999 })).status, 400);
        assert.equal((await send({ subject: 'Dirty rooms', description: 'The rooms are dirty', mess_id: 1 }, admin)).status, 403);
        assert.equal((await request(api.base, 'POST', '/complaints', { body: {} })).status, 401);
    });

    it('a student complains about a mess and the admin is told', async () => {
        const result = await request(api.base, 'POST', '/complaints', { token: rafsan, body: { subject: 'Dirty rooms', description: 'The rooms are not cleaned', mess_id: 1 } });
        assert.equal(result.status, 201, JSON.stringify(result.body));
        assert.equal(result.body.status, 'open');
        const notes = await query("SELECT COUNT(*) AS n FROM notifications WHERE user_id = 1 AND message = 'New complaint: Dirty rooms'");
        assert.equal(notes[0].n, 1);

        const mine = await request(api.base, 'GET', '/complaints/my', { token: rafsan });
        assert.equal(mine.body.length, 1);
        assert.equal(mine.body[0].mess_name, 'Rahman Boys Mess');
        assert.equal(mine.body[0].admin_note, null);
    });

    it('a manager complains about a member, and it is about his own mess', async () => {
        const result = await request(api.base, 'POST', '/complaints', { token: abdur, body: { subject: 'Loud music', description: 'Every night after midnight', against_user_id: 9 } });
        assert.equal(result.status, 201);
        assert.equal(result.body.mess_id, 1);
        assert.equal(result.body.against_user_id, 9);
        const mine = await request(api.base, 'GET', '/complaints/my', { token: abdur });
        assert.equal(mine.body.find((c) => c.complaint_id === result.body.complaint_id).against_name, 'Sumon Ahmed');
        // the complaints of one user are not shown to another
        assert.equal((await request(api.base, 'GET', '/complaints/my', { token: rafsan })).body.length, 1);
    });
});

describe('notifications', () => {
    let api, snapshot, student, abdur, postId;
    before(async () => {
        api = await startServer();
        snapshot = await takeSnapshot();
        student = await registerUser(api.base, 'student');
        abdur = await loginAs(api.base, 'abdur.rahman@example.com');
        // two comments of a manager on a post of the new student make two notifications for him
        const post = await request(api.base, 'POST', '/seat-wanted', {
            token: student.token, body: { title: 'Need a seat in Mirpur', mess_type: 'boys', needed_from: '2099-01-01' },
        });
        postId = post.body.wanted_id;
        await request(api.base, 'POST', `/posts/wanted/${postId}/comments`, { token: abdur, body: { body: 'We have a seat.' } });
        await request(api.base, 'POST', `/posts/wanted/${postId}/comments`, { token: abdur, body: { body: 'Message us.' } });
    });
    after(async () => {
        await restoreSnapshot(snapshot);
        await deleteTestUser(student.user.user_id);
        await api.close();
    });

    it('needs a login', async () => {
        assert.equal((await request(api.base, 'GET', '/notifications')).status, 401);
        assert.equal((await request(api.base, 'PATCH', '/notifications/read-all')).status, 401);
    });

    it('lists the notifications newest first with the unread count', async () => {
        const result = await request(api.base, 'GET', '/notifications', { token: student.token });
        assert.equal(result.status, 200);
        assert.equal(result.body.total, 2);
        assert.equal(result.body.unread_count, 2);
        assert.equal(result.body.data[0].message, 'New comment on your post: Message us.');
        assert.equal(result.body.data[0].is_read, 0);
    });

    it('marks one as read, then all', async () => {
        const first = (await request(api.base, 'GET', '/notifications', { token: student.token })).body.data[0];

        assert.equal((await request(api.base, 'PATCH', `/notifications/${first.notification_id}/read`, { token: abdur })).status, 404);   // not his
        assert.equal((await request(api.base, 'PATCH', `/notifications/${first.notification_id}/read`, { token: student.token })).status, 200);
        assert.equal((await request(api.base, 'GET', '/notifications', { token: student.token })).body.unread_count, 1);

        const unread = await request(api.base, 'GET', '/notifications?unread=1', { token: student.token });
        assert.equal(unread.body.total, 1);
        assert.equal(unread.body.data[0].message, 'New comment on your post: We have a seat.');

        const all = await request(api.base, 'PATCH', '/notifications/read-all', { token: student.token });
        assert.equal(all.body.marked, 1);
        assert.equal((await request(api.base, 'GET', '/notifications', { token: student.token })).body.unread_count, 0);
        assert.equal((await request(api.base, 'PATCH', '/notifications/9999999/read', { token: student.token })).status, 404);
    });

    it('wrong parameters give 400', async () => {
        assert.equal((await request(api.base, 'GET', '/notifications?limit=9999', { token: student.token })).status, 400);
        assert.equal((await request(api.base, 'PATCH', '/notifications/abc/read', { token: student.token })).status, 400);
    });
});

describe('profile and password', () => {
    let api, student, manager;
    before(async () => {
        api = await startServer();
        student = await registerUser(api.base, 'student');
        manager = await registerUser(api.base, 'manager');
    });
    after(async () => {
        await deleteTestUser(student.user.user_id);
        await deleteTestUser(manager.user.user_id);
        await api.close();
    });

    it('a student changes his name, phone and details', async () => {
        const result = await request(api.base, 'PATCH', '/auth/me', {
            token: student.token,
            body: { full_name: 'Renamed Student', phone: '+8801398765432', department: 'EEE', student_roll: '999', university_id: 4 },
        });
        assert.equal(result.status, 200, JSON.stringify(result.body));
        assert.equal(result.body.full_name, 'Renamed Student');
        assert.equal(result.body.phone, '01398765432');
        assert.equal(result.body.profile.department, 'EEE');
        assert.equal(result.body.profile.university_short_name, 'BracU');
    });

    it('only the fields that are sent are changed', async () => {
        const result = await request(api.base, 'PATCH', '/auth/me', { token: student.token, body: { department: 'Law' } });
        assert.equal(result.body.full_name, 'Renamed Student');
        assert.equal(result.body.profile.department, 'Law');
    });

    it('refuses wrong input', async () => {
        const patch = (body) => request(api.base, 'PATCH', '/auth/me', { token: student.token, body });
        assert.equal((await patch({})).status, 400);
        assert.equal((await patch({ phone: '123' })).status, 400);
        assert.equal((await patch({ full_name: 'A' })).status, 400);
        assert.equal((await patch({ university_id: 9999 })).status, 400);
        const taken = await patch({ phone: '01711000008' });          // the phone of Rafiul
        assert.equal(taken.status, 409);
        assert.match(taken.body.error, /phone/i);
        assert.equal((await request(api.base, 'PATCH', '/auth/me', { body: { full_name: 'No Login' } })).status, 401);
    });

    it('the email and the role cannot be changed this way', async () => {
        const result = await request(api.base, 'PATCH', '/auth/me', { token: student.token, body: { email: 'new@example.com', role: 'admin', department: 'CSE' } });
        assert.equal(result.status, 200);
        assert.equal(result.body.email, student.user.email);
        assert.equal(result.body.role, 'student');
    });

    it('a manager changes his address', async () => {
        const result = await request(api.base, 'PATCH', '/auth/me', { token: manager.token, body: { address: 'New address, Dhaka' } });
        assert.equal(result.body.profile.address, 'New address, Dhaka');
    });

    it('changes the password', async () => {
        const change = (body) => request(api.base, 'PATCH', '/auth/password', { token: student.token, body });
        assert.equal((await change({ new_password: 'Another123' })).status, 400);
        assert.equal((await change({ current_password: 'Wrong-pass1', new_password: 'Another123' })).status, 401);
        assert.equal((await change({ current_password: 'Secret123', new_password: 'weak' })).status, 400);
        assert.equal((await change({ current_password: 'Secret123', new_password: 'Another123' })).status, 200);

        const oldLogin = await request(api.base, 'POST', '/auth/login', { body: { email: student.user.email, password: 'Secret123' } });
        assert.equal(oldLogin.status, 401);
        const newLogin = await request(api.base, 'POST', '/auth/login', { body: { email: student.user.email, password: 'Another123' } });
        assert.equal(newLogin.status, 200);
    });
});
