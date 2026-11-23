// Tests of the Members page of the manager: the lists, adding a member, payments, leaving, the dashboard.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, request, loginAs, closePool, query, takeSnapshot, restoreSnapshot, today } = require('./helpers');

after(closePool);

describe('who can use the members routes', () => {
    let api;
    before(async () => { api = await startServer(); });
    after(async () => { await api.close(); });

    it('needs a manager', async () => {
        for (const path of ['/manager/members', '/manager/members/ex', '/manager/dues', '/manager/payments', '/manager/dashboard']) {
            assert.equal((await request(api.base, 'GET', path)).status, 401, path);
            const student = await loginAs(api.base, 'rafiul.islam@example.com');
            assert.equal((await request(api.base, 'GET', path, { token: student })).status, 403, path);
        }
    });
});

describe('the lists of members', () => {
    let api, abdur, kamal;
    before(async () => {
        api = await startServer();
        abdur = await loginAs(api.base, 'abdur.rahman@example.com');   // Rahman Boys Mess (mess 1)
        kamal = await loginAs(api.base, 'kamal.hossain@example.com');   // Green Nest Mess (mess 2)
    });
    after(async () => { await api.close(); });

    it('lists the active members with their rent numbers', async () => {
        const result = await request(api.base, 'GET', '/manager/members', { token: abdur });
        assert.equal(result.status, 200);
        assert.equal(result.body.total, 5);
        const sumon = result.body.data.find((m) => m.full_name === 'Sumon Ahmed');
        assert.equal(sumon.outstanding, 6000);
        assert.equal(sumon.overdue_count, 2);
        assert.equal(sumon.is_linked, 1);
        assert.equal(sumon.room_no, '101');
        const hridoy = result.body.data.find((m) => m.full_name === 'Hridoy Mondal');
        assert.equal(hridoy.is_linked, 0);          // no account on the website
        assert.equal(hridoy.monthly_rent, 3600);    // the rent he joined with, not the rent of the seat now
    });

    it('the summary counts this month\'s status like the database does', async () => {
        const result = await request(api.base, 'GET', '/manager/members', { token: abdur });
        const rows = await query("SELECT current_month_status AS s, COUNT(*) AS n FROM v_member_dues WHERE mess_id = 1 AND member_status = 'active' GROUP BY current_month_status");
        const expected = { paid: 0, partial: 0, due: 0, overdue: 0, none: 0 };
        for (const row of rows) expected[row.s === null ? 'none' : row.s] = row.n;
        assert.deepEqual({ ...result.body.summary, total: undefined }, { ...expected, total: undefined });
        assert.equal(result.body.summary.total, 5);
    });

    it('filters by the status of this month, by dues and by words', async () => {
        const partial = await request(api.base, 'GET', '/manager/members?month_status=partial', { token: abdur });
        const expected = await query("SELECT COUNT(*) AS n FROM v_member_dues WHERE mess_id = 1 AND member_status = 'active' AND current_month_status = 'partial'");
        assert.equal(partial.body.total, expected[0].n);

        const owing = await request(api.base, 'GET', '/manager/members?with_dues=1&sort=outstanding', { token: abdur });
        assert.deepEqual(owing.body.data.map((m) => m.full_name), ['Sumon Ahmed', 'Nayeem Uddin']);

        assert.deepEqual((await request(api.base, 'GET', '/manager/members?q=rafi', { token: abdur })).body.data.map((m) => m.full_name), ['Rafiul Islam']);
        assert.equal((await request(api.base, 'GET', '/manager/members?q=101-A', { token: abdur })).body.total, 1);
        assert.equal((await request(api.base, 'GET', '/manager/members?q=%25', { token: abdur })).body.total, 0);
    });

    it('can show the members who left', async () => {
        const result = await request(api.base, 'GET', '/manager/members?status=left', { token: abdur });
        assert.deepEqual(result.body.data.map((m) => m.full_name), ['Mehedi Hasan']);
    });

    it('wrong parameters give 400', async () => {
        for (const path of ['/manager/members?status=gone', '/manager/members?month_status=late', '/manager/members?sort=age', '/manager/members?limit=1000']) {
            assert.equal((await request(api.base, 'GET', path, { token: abdur })).status, 400, path);
        }
    });

    it('every manager sees only his own members', async () => {
        const result = await request(api.base, 'GET', '/manager/members', { token: kamal });
        assert.equal(result.body.total, 6);
        assert.ok(!result.body.data.some((m) => m.full_name === 'Rafiul Islam'));
    });

    it('ex-members come with the full story', async () => {
        const result = await request(api.base, 'GET', '/manager/members/ex', { token: kamal });
        assert.equal(result.body.total, 1);
        const tanvir = result.body.data[0];
        assert.equal(tanvir.full_name, 'Tanvir Hasan');
        assert.equal(tanvir.leave_date, '2026-09-30');
        assert.equal(tanvir.months_stayed, 7);
        assert.equal(tanvir.advance_amount, 4500);
        assert.equal(tanvir.outstanding, 2700);   // he left with 60% of September unpaid

        const paid = await query('SELECT SUM(amount) AS total FROM payments WHERE member_id = ?', [tanvir.member_id]);
        assert.equal(tanvir.total_paid, paid[0].total);

        const mehedi = (await request(api.base, 'GET', '/manager/members/ex', { token: abdur })).body.data[0];
        assert.equal(mehedi.full_name, 'Mehedi Hasan');
        assert.equal(mehedi.outstanding, 0);
    });

    it('the details of a member: dues, payments and what he owes', async () => {
        const result = await request(api.base, 'GET', '/manager/members/3', { token: abdur });
        assert.equal(result.status, 200);
        assert.equal(result.body.member.full_name, 'Sumon Ahmed');
        assert.equal(result.body.dues.length, 6);           // June to November
        assert.equal(result.body.outstanding, 6000);
        assert.equal(result.body.dues[0].remaining, 3000);  // newest first
        assert.ok(result.body.payments.some((p) => p.payment_type === 'advance' && p.amount === 2000));
        assert.equal((await request(api.base, 'GET', '/manager/members/3', { token: kamal })).status, 404);
        assert.equal((await request(api.base, 'GET', '/manager/members/abc', { token: abdur })).status, 400);
    });

    it('finds student accounts to link, and shows if the gender fits the mess', async () => {
        const rafsan = await request(api.base, 'GET', '/manager/students/search?q=rafsan', { token: abdur });
        assert.equal(rafsan.body.length, 1);
        assert.equal(rafsan.body[0].gender_ok, 1);          // Rahman Boys Mess takes boys
        assert.equal(rafsan.body[0].already_in_a_mess, 0);

        const anika = await request(api.base, 'GET', '/manager/students/search?q=anika', { token: abdur });
        assert.equal(anika.body[0].gender_ok, 0);

        const rafiul = await request(api.base, 'GET', '/manager/students/search?q=01711000008', { token: abdur });
        assert.equal(rafiul.body[0].full_name, 'Rafiul Islam');
        assert.equal(rafiul.body[0].already_in_a_mess, 1);

        assert.equal((await request(api.base, 'GET', '/manager/students/search?q=ra', { token: abdur })).status, 400);
        // a blocked student is not offered
        assert.equal((await request(api.base, 'GET', '/manager/students/search?q=kabir', { token: abdur })).body.length, 0);
    });

    it('the overdue list matches the view of the database', async () => {
        const result = await request(api.base, 'GET', '/manager/dues/overdue', { token: abdur });
        const expected = await query('SELECT COUNT(*) AS n FROM v_overdue_dues WHERE mess_id = 1');
        assert.equal(result.body.length, expected[0].n);
        assert.ok(result.body.every((due) => due.days_late > 0));
        const lates = result.body.map((due) => due.days_late);
        assert.deepEqual(lates, [...lates].sort((a, b) => b - a));
    });

    it('lists the dues with what was paid and what is left', async () => {
        const result = await request(api.base, 'GET', '/manager/dues?member_id=4&status=partial', { token: abdur });
        assert.equal(result.body.total, 1);
        assert.equal(result.body.data[0].amount, 3500);
        assert.equal(result.body.data[0].paid, 1750);
        assert.equal(result.body.data[0].remaining, 1750);

        assert.equal((await request(api.base, 'GET', '/manager/dues?month=2026-11&status=overdue', { token: abdur })).status, 200);
        for (const path of ['/manager/dues?month=nov', '/manager/dues?status=late']) {
            assert.equal((await request(api.base, 'GET', path, { token: abdur })).status, 400, path);
        }
    });

    it('lists the payments of a member', async () => {
        const result = await request(api.base, 'GET', '/manager/payments?member_id=3', { token: abdur });
        const expected = await query('SELECT COUNT(*) AS n FROM payments WHERE member_id = 3');
        assert.equal(result.body.total, expected[0].n);
        const dates = result.body.data.map((p) => p.paid_at);
        assert.deepEqual(dates, [...dates].sort().reverse());
    });
});

describe('add a member, take payments, let him leave', () => {
    let api, snapshot, abdur, kamal, rafsan, memberA, memberB, dueA;
    before(async () => {
        api = await startServer();
        snapshot = await takeSnapshot();
        abdur = await loginAs(api.base, 'abdur.rahman@example.com');
        kamal = await loginAs(api.base, 'kamal.hossain@example.com');
        rafsan = await loginAs(api.base, 'rafsan.jani@example.com');
    });
    after(async () => {
        await restoreSnapshot(snapshot);
        await query("UPDATE seats SET status = 'available' WHERE seat_id IN (5, 7) AND status = 'booked'");
        await api.close();
    });

    it('refuses wrong input', async () => {
        const day = await today();
        const ok = { seat_id: 5, full_name: 'Walk In', phone: '01712999888', gender: 'male', join_date: day };
        const bad = [
            [{ ...ok, seat_id: undefined }, /Seat/],
            [{ ...ok, full_name: undefined }, /Full name/],
            [{ ...ok, phone: '123' }, /Phone/],
            [{ ...ok, gender: 'robot' }, /Gender/],
            [{ ...ok, join_date: 'today' }, /Join date/],
            [{ ...ok, join_date: '2099-01-01' }, /within/],
            [{ ...ok, payment_method: 'gold' }, /Payment method/],
            [{ ...ok, monthly_rent: 0 }, /Monthly rent/],
        ];
        for (const [body, pattern] of bad) {
            const result = await request(api.base, 'POST', '/manager/members', { token: abdur, body });
            assert.equal(result.status, 400, JSON.stringify(result.body));
            assert.match(result.body.error, pattern);
        }
    });

    it('the database rules stop a wrong member and nothing is left behind', async () => {
        const day = await today();
        const add = (token, body) => request(api.base, 'POST', '/manager/members', { token, body: { join_date: day, ...body } });

        assert.match((await add(abdur, { seat_id: 1, student_id: 28 })).body.error, /not available/);                       // seat 1 is taken
        assert.match((await add(abdur, { seat_id: 15, student_id: 28 })).body.error, /does not belong to your mess/);        // seat of Green Nest
        assert.match((await add(abdur, { seat_id: 5, student_id: 29 })).body.error, /Gender does not match/);                 // a girl in a boys mess
        assert.match((await add(abdur, { seat_id: 5, student_id: 31 })).body.error, /not found or blocked/);                  // blocked student
        assert.match((await add(abdur, { seat_id: 5, student_id: 8 })).body.error, /./);                                       // Rafiul lives in another seat already
        assert.match((await add(abdur, { seat_id: 9999, student_id: 28 })).body.error, /Seat not found/);

        assert.equal((await query('SELECT COUNT(*) AS n FROM mess_members WHERE member_id > ?', [snapshot.mess_members]))[0].n, 0);
        assert.equal((await query('SELECT status FROM seats WHERE seat_id = 5'))[0].status, 'available');
    });

    it('adds a student: the account gives name and gender, the seat is booked', async () => {
        const day = await today();
        const result = await request(api.base, 'POST', '/manager/members', {
            token: abdur,
            body: { seat_id: 5, student_id: 28, occupation: 'Student', advance_amount: 3500, payment_method: 'cash', join_date: day },
        });
        assert.equal(result.status, 201, JSON.stringify(result.body));
        assert.equal(result.body.member.full_name, 'Rafsan Jani');
        assert.equal(result.body.member.gender, 'male');
        assert.equal(result.body.member.status, 'active');
        assert.equal(result.body.member.is_linked, true);
        assert.equal(result.body.member.monthly_rent, 3500);     // the rent of the seat now
        assert.equal(result.body.dues.length, 1);                // the rent of the joining month, in full
        assert.equal(result.body.dues[0].amount, 3500);
        assert.equal(result.body.dues[0].status, 'due');
        assert.equal(result.body.payments.length, 1);            // the advance
        assert.equal(result.body.payments[0].payment_type, 'advance');
        assert.equal(result.body.outstanding, 3500);
        memberA = result.body.member.member_id;
        dueA = result.body.dues[0].due_id;

        assert.equal((await query('SELECT status FROM seats WHERE seat_id = 5'))[0].status, 'booked');
    });

    it('the student is told, and sees the mess on his own page', async () => {
        const notes = await query("SELECT COUNT(*) AS n FROM notifications WHERE user_id = 28 AND message LIKE 'You were added to Rahman Boys Mess%'");
        assert.equal(notes[0].n, 1);

        const membership = await request(api.base, 'GET', '/me/membership', { token: rafsan });
        assert.equal(membership.body.membership.mess_name, 'Rahman Boys Mess');
        assert.equal(membership.body.membership.seat_label, 'B');
        const dues = await request(api.base, 'GET', '/me/dues', { token: rafsan });
        assert.equal(dues.body.dues.length, 1);
        assert.equal(dues.body.outstanding, 3500);
    });

    it('adds a person without an account, with his own rent', async () => {
        const day = await today();
        const result = await request(api.base, 'POST', '/manager/members', {
            token: abdur,
            body: { seat_id: 7, full_name: 'Walk In', phone: '+8801712999888', gender: 'male', occupation: 'Job', monthly_rent: 3900, join_date: day },
        });
        assert.equal(result.status, 201, JSON.stringify(result.body));
        assert.equal(result.body.member.is_linked, false);
        assert.equal(result.body.member.phone, '01712999888');
        assert.equal(result.body.member.monthly_rent, 3900);
        assert.equal(result.body.payments.length, 0);            // no advance
        memberB = result.body.member.member_id;
    });

    it('both are in the lists now, and the numbers of the mess moved', async () => {
        const list = await request(api.base, 'GET', '/manager/members', { token: abdur });
        assert.equal(list.body.total, 7);
        const dashboard = await request(api.base, 'GET', '/manager/dashboard', { token: abdur });
        assert.equal(dashboard.body.stats.booked_seats, 7);
        assert.equal(dashboard.body.stats.free_seats, 3);
        assert.equal(dashboard.body.stats.occupancy_percent, 70);
    });

    it('takes a part payment, then the rest', async () => {
        const first = await request(api.base, 'POST', '/manager/payments', { token: abdur, body: { member_id: memberA, due_id: dueA, amount: 1000, method: 'bkash' } });
        assert.equal(first.status, 201, JSON.stringify(first.body));
        assert.equal(first.body.payment.payment_type, 'monthly');
        assert.equal(first.body.due.status, 'partial');
        assert.equal(first.body.due.remaining, 2500);

        const second = await request(api.base, 'POST', '/manager/payments', { token: abdur, body: { member_id: memberA, due_id: dueA, amount: 2500, method: 'cash', paid_at: '2026-11-22 10:30' } });
        assert.equal(second.body.due.status, 'paid');
        assert.equal(second.body.due.remaining, 0);
        assert.equal(second.body.payment.paid_at, '2026-11-22 10:30:00');
    });

    it('refuses wrong payments', async () => {
        const pay = (token, body) => request(api.base, 'POST', '/manager/payments', { token, body });
        assert.match((await pay(abdur, { member_id: memberA, due_id: dueA, amount: 1, method: 'cash' })).body.error, /more than the remaining due/);
        const otherDue = (await query('SELECT due_id FROM rent_dues WHERE member_id = 3 LIMIT 1'))[0].due_id;
        assert.match((await pay(abdur, { member_id: memberA, due_id: otherDue, amount: 10, method: 'cash' })).body.error, /does not belong to the member/);
        assert.match((await pay(kamal, { member_id: memberA, amount: 10, method: 'cash' })).body.error, /does not belong to your mess/);
        assert.match((await pay(abdur, { member_id: 9999, amount: 10, method: 'cash' })).body.error, /Member not found/);
        for (const body of [{ member_id: memberA, amount: 0, method: 'cash' }, { member_id: memberA, amount: 10, method: 'gold' },
                            { member_id: memberA, amount: 10, method: 'cash', paid_at: 'noon' }, { amount: 10, method: 'cash' }]) {
            assert.equal((await pay(abdur, body)).status, 400, JSON.stringify(body));
        }
    });

    it('an advance payment has no due', async () => {
        const result = await request(api.base, 'POST', '/manager/payments', { token: abdur, body: { member_id: memberA, amount: 500, method: 'nagad' } });
        assert.equal(result.status, 201);
        assert.equal(result.body.payment.payment_type, 'advance');
        assert.equal(result.body.due, null);
    });

    it('the student sees the payments, newest first', async () => {
        const result = await request(api.base, 'GET', '/me/payments', { token: rafsan });
        assert.equal(result.body.length, 4);   // advance 3500, 1000, 2500, advance 500
        assert.ok(result.body.every((p) => p.mess_name === 'Rahman Boys Mess'));
        const dates = result.body.map((p) => p.paid_at);
        assert.deepEqual(dates, [...dates].sort().reverse());

        const manager = await request(api.base, 'GET', `/manager/payments?member_id=${memberA}`, { token: abdur });
        assert.equal(manager.body.total, 4);
        const dues = await request(api.base, 'GET', `/manager/dues?member_id=${memberA}`, { token: abdur });
        assert.equal(dues.body.data[0].status, 'paid');
    });

    it('a member leaves: the seat is free again and the student is told', async () => {
        const day = await today();
        assert.equal((await request(api.base, 'PATCH', `/manager/members/${memberB}/leave`, { token: kamal, body: { leave_date: day } })).status, 404);
        assert.match((await request(api.base, 'PATCH', `/manager/members/${memberB}/leave`, { token: abdur, body: { leave_date: '2000-01-01' } })).body.error, /before the join date/);
        assert.equal((await request(api.base, 'PATCH', `/manager/members/${memberB}/leave`, { token: abdur, body: { leave_date: 'soon' } })).status, 400);

        const left = await request(api.base, 'PATCH', `/manager/members/${memberA}/leave`, { token: abdur });   // today by default
        assert.equal(left.status, 200, JSON.stringify(left.body));
        assert.equal(left.body.member.status, 'left');
        assert.equal(left.body.member.leave_date, day);
        assert.equal((await query('SELECT status FROM seats WHERE seat_id = 5'))[0].status, 'available');

        const notes = await query("SELECT COUNT(*) AS n FROM notifications WHERE user_id = 28 AND message LIKE 'You were marked as left%'");
        assert.equal(notes[0].n, 1);
        assert.equal((await request(api.base, 'GET', '/me/membership', { token: rafsan })).body.membership, null);
        assert.match((await request(api.base, 'PATCH', `/manager/members/${memberA}/leave`, { token: abdur })).body.error, /already left/);

        // and he appears among the ex-members with his payments
        const ex = await request(api.base, 'GET', '/manager/members/ex', { token: abdur });
        assert.ok(ex.body.data.some((m) => m.member_id === memberA && m.total_paid === 7500));
        await request(api.base, 'PATCH', `/manager/members/${memberB}/leave`, { token: abdur, body: { leave_date: day } });
    });
});

describe('the dashboard', () => {
    let api, abdur;
    before(async () => {
        api = await startServer();
        abdur = await loginAs(api.base, 'abdur.rahman@example.com');
    });
    after(async () => { await api.close(); });

    it('shows the same numbers as the view of the database', async () => {
        const result = await request(api.base, 'GET', '/manager/dashboard', { token: abdur });
        assert.equal(result.status, 200);
        assert.equal(result.body.mess.mess_name, 'Rahman Boys Mess');

        const view = (await query('SELECT total_seats, free_seats, booked_seats, occupancy_percent, active_members, members_with_dues, total_outstanding, collected_this_month FROM v_manager_stats WHERE mess_id = 1'))[0];
        assert.deepEqual(result.body.stats, view);
        assert.equal(result.body.stats.total_seats, 10);
    });

    it('lists the members who owe the most, and the activity', async () => {
        const result = await request(api.base, 'GET', '/manager/dashboard', { token: abdur });
        assert.deepEqual(result.body.top_dues.map((d) => d.full_name), ['Sumon Ahmed', 'Nayeem Uddin']);
        assert.equal(result.body.top_dues[0].outstanding, 6000);

        const visits = await query("SELECT COUNT(*) AS n FROM visit_requests WHERE mess_id = 1 AND status = 'pending'");
        assert.equal(result.body.activity.pending_visits, visits[0].n);
        const unread = await query('SELECT COUNT(*) AS n FROM notifications WHERE user_id = 2 AND is_read = 0');
        assert.equal(result.body.activity.unread_notifications, unread[0].n);
        assert.ok(result.body.activity.recent_interests.length <= 3);
    });

    it('a manager without a mess is told so', async () => {
        const result = await request(api.base, 'GET', '/manager/dashboard', { token: await loginAs(api.base, 'mizanur.rahman@example.com') });
        assert.equal(result.status, 200);       // his mess exists (pending), the cards are all zero
        assert.equal(result.body.stats.total_seats, 5);
        assert.equal(result.body.stats.active_members, 0);
        assert.equal(result.body.mess.status, 'pending');
    });
});
