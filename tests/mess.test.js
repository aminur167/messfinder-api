// Tests of /api/messes and /api/reference. They expect the demo data of database/seed.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, request, loginAs, closePool } = require('./helpers');

after(closePool);

describe('reference lists', () => {
    let api;
    before(async () => { api = await startServer(); });
    after(async () => { await api.close(); });

    it('areas and universities can be searched, limited and asked by id', async () => {
        const all = await request(api.base, 'GET', '/reference/universities');
        const first = all.body[0];

        const limited = await request(api.base, 'GET', '/reference/universities?limit=2');
        assert.equal(limited.body.length, 2);

        const byId = await request(api.base, 'GET', `/reference/universities?id=${first.university_id}`);
        assert.deepEqual(byId.body.map((u) => u.university_id), [first.university_id]);

        const found = await request(api.base, 'GET', `/reference/universities?q=${encodeURIComponent(first.short_name)}`);
        assert.ok(found.body.some((u) => u.university_id === first.university_id));
        assert.deepEqual((await request(api.base, 'GET', '/reference/universities?q=zzzzzz')).body, []);

        const area = await request(api.base, 'GET', '/reference/areas?q=pur&limit=3');
        assert.ok(area.body.length <= 3 && area.body.every((a) => a.area_name.toLowerCase().includes('pur')));
        assert.equal((await request(api.base, 'GET', '/reference/areas?limit=500')).status, 400);
        assert.equal((await request(api.base, 'GET', '/reference/areas?id=abc')).status, 400);
    });

    it('areas, universities and facilities', async () => {
        const areas = await request(api.base, 'GET', '/reference/areas');
        const universities = await request(api.base, 'GET', '/reference/universities');
        const facilities = await request(api.base, 'GET', '/reference/facilities');
        assert.equal(areas.body.length, 9);
        assert.equal(universities.body.length, 9);
        assert.equal(facilities.body.length, 10);
        assert.ok(universities.body[0].latitude);
    });
});

describe('mess list', () => {
    let api;
    before(async () => { api = await startServer(); });
    after(async () => { await api.close(); });

    const ids = (result) => result.body.data.map((mess) => mess.mess_id).sort((a, b) => a - b);

    it('shows only verified messes', async () => {
        const result = await request(api.base, 'GET', '/messes');
        assert.equal(result.status, 200);
        assert.equal(result.body.total, 5);
        assert.deepEqual(ids(result), [1, 2, 3, 4, 5]);   // mess 6 is still pending
    });

    it('a card has the numbers the page needs', async () => {
        const result = await request(api.base, 'GET', '/messes?sort=rent_low');
        const first = result.body.data[0];
        assert.equal(first.mess_id, 1);
        assert.equal(first.min_rent, 3000);
        assert.equal(first.max_rent, 4200);
        assert.equal(first.free_seats, 5);
        assert.equal(first.avg_rating, 3.67);
        assert.equal(first.area_name, 'Mirpur');
        assert.equal(first.facilities.length, 4);
        assert.equal(first.is_interested, false);
        assert.equal(first.distance_km, null);
    });

    it('filters by type', async () => {
        assert.deepEqual(ids(await request(api.base, 'GET', '/messes?type=girls')), [3, 5]);
        assert.deepEqual(ids(await request(api.base, 'GET', '/messes?type=boys')), [1, 2, 4]);
    });

    it('filters by area', async () => {
        assert.deepEqual(ids(await request(api.base, 'GET', '/messes?area_id=1')), [1]);
    });

    it('filters by rent range', async () => {
        assert.deepEqual(ids(await request(api.base, 'GET', '/messes?min_rent=4600')), [2, 4]);
        assert.deepEqual(ids(await request(api.base, 'GET', '/messes?max_rent=3200')), [1]);
    });

    it('filters by meal, utility, free seats and rating', async () => {
        assert.deepEqual(ids(await request(api.base, 'GET', '/messes?has_meal=1')), [2, 3, 5]);
        assert.deepEqual(ids(await request(api.base, 'GET', '/messes?utility_included=1')), [2, 4, 5]);
        assert.equal((await request(api.base, 'GET', '/messes?only_free=1')).body.total, 5);
        assert.deepEqual(ids(await request(api.base, 'GET', '/messes?min_rating=4.5')), [4, 5]);
    });

    it('filters by facilities: the mess must have all of them', async () => {
        assert.deepEqual(ids(await request(api.base, 'GET', '/messes?facility_ids=4')), [4]);          // lift
        assert.deepEqual(ids(await request(api.base, 'GET', '/messes?facility_ids=1,6')), [2, 3, 4]);  // wifi and CCTV
    });

    it('searches words in the name, address and description', async () => {
        assert.deepEqual(ids(await request(api.base, 'GET', '/messes?q=rooftop')), [4]);
        assert.deepEqual(ids(await request(api.base, 'GET', '/messes?q=Mirpur')), [1]);
        assert.deepEqual(ids(await request(api.base, 'GET', '/messes?q=%25')), []);   // a % is searched as a letter, not as a wildcard
    });

    it('filters by a university listed as nearby', async () => {
        assert.deepEqual(ids(await request(api.base, 'GET', '/messes?university_id=9')), [2, 3]);
    });

    it('sorts', async () => {
        assert.equal((await request(api.base, 'GET', '/messes?sort=rating')).body.data[0].mess_id, 5);
        assert.equal((await request(api.base, 'GET', '/messes?sort=rent_high')).body.data[0].max_rent, 5500);
    });

    it('splits the list into pages', async () => {
        const page3 = await request(api.base, 'GET', '/messes?limit=2&page=3');
        assert.equal(page3.body.total, 5);
        assert.equal(page3.body.total_pages, 3);
        assert.equal(page3.body.data.length, 1);
        const page1 = await request(api.base, 'GET', '/messes?limit=2&page=1');
        assert.equal(page1.body.data.length, 2);
    });

    it('wrong parameters give 400', async () => {
        for (const path of ['/messes?type=cats', '/messes?limit=1000', '/messes?sort=weird', '/messes?area_id=abc',
                            '/messes?min_rating=9', '/messes?sort=nearest', '/messes/nearby']) {
            const result = await request(api.base, 'GET', path);
            assert.equal(result.status, 400, path);
        }
    });

    it('a SQL injection attempt is only text', async () => {
        const result = await request(api.base, 'GET', "/messes?q=x'%20OR%201=1%20--%20");
        assert.equal(result.status, 200);
        assert.equal(result.body.total, 0);
    });

    it('nearby: messes within 3 km of North South University', async () => {
        const result = await request(api.base, 'GET', '/messes/nearby?university_id=3&km=3');
        assert.equal(result.status, 200);
        assert.deepEqual(ids(result), [4]);
        assert.ok(result.body.data[0].distance_km > 0 && result.body.data[0].distance_km <= 3);
    });

    it('nearby: a wide search lists everything, nearest first', async () => {
        const result = await request(api.base, 'GET', '/messes/nearby?university_id=3&km=100');
        assert.equal(result.body.total, 5);
        const distances = result.body.data.map((mess) => mess.distance_km);
        assert.deepEqual(distances, [...distances].sort((a, b) => a - b));
        assert.equal(result.body.data[0].mess_id, 4);
    });

    it('a logged in student sees which messes he marked as Interested', async () => {
        const token = await loginAs(api.base, 'rafsan.jani@example.com');
        const result = await request(api.base, 'GET', '/messes', { token });
        const interested = result.body.data.filter((mess) => mess.is_interested).map((mess) => mess.mess_id).sort();
        assert.deepEqual(interested, [1, 2]);
    });
});

describe('mess details', () => {
    let api;
    before(async () => { api = await startServer(); });
    after(async () => { await api.close(); });

    it('anybody can see the details, but not the phone numbers', async () => {
        const result = await request(api.base, 'GET', '/messes/1');
        assert.equal(result.status, 200);
        assert.equal(result.body.mess_name, 'Rahman Boys Mess');
        assert.equal(result.body.facilities.length, 4);
        assert.equal(result.body.universities.length, 3);
        assert.equal(result.body.stats.free_seats, 5);
        assert.equal(result.body.history.total_members_ever, 6);
        assert.equal(result.body.history.current_members, 5);
        assert.equal(result.body.ratings.review_count, 3);
        assert.equal(result.body.viewer.logged_in, false);
        assert.equal('contact_phone' in result.body, false);
        assert.equal('contact_whatsapp' in result.body, false);
    });

    it('a logged in user also gets the contact numbers', async () => {
        const token = await loginAs(api.base, 'rafiul.islam@example.com');
        const result = await request(api.base, 'GET', '/messes/1', { token });
        assert.equal(result.body.contact_phone, '8801811000002');
        assert.equal(result.body.contact_whatsapp, '8801811000002');
        assert.equal(result.body.manager_name, 'Abdur Rahman');
    });

    it('tells a student what he can do here', async () => {
        // Rafiul lives here and already wrote a review
        const member = await request(api.base, 'GET', '/messes/1', { token: await loginAs(api.base, 'rafiul.islam@example.com') });
        assert.equal(member.body.viewer.is_member, true);
        assert.equal(member.body.viewer.has_reviewed, true);
        assert.equal(member.body.viewer.can_review, false);

        // Nayeem lives here and has not reviewed yet
        const nayeem = await request(api.base, 'GET', '/messes/1', { token: await loginAs(api.base, 'nayeem.uddin@example.com') });
        assert.equal(nayeem.body.viewer.can_review, true);

        // Rafsan only showed interest and started a chat
        const rafsan = await request(api.base, 'GET', '/messes/1', { token: await loginAs(api.base, 'rafsan.jani@example.com') });
        assert.equal(rafsan.body.viewer.is_interested, true);
        assert.equal(rafsan.body.viewer.can_review, false);
        assert.equal(rafsan.body.viewer.conversation_id, 1);
    });

    it('a mess that is not verified is hidden from everybody except its manager and the admin', async () => {
        assert.equal((await request(api.base, 'GET', '/messes/6')).status, 404);
        assert.equal((await request(api.base, 'GET', '/messes/6', { token: await loginAs(api.base, 'rafiul.islam@example.com') })).status, 404);
        assert.equal((await request(api.base, 'GET', '/messes/6', { token: await loginAs(api.base, 'abdur.rahman@example.com') })).status, 404);
        const owner = await request(api.base, 'GET', '/messes/6', { token: await loginAs(api.base, 'mizanur.rahman@example.com') });
        assert.equal(owner.status, 200);
        assert.equal(owner.body.viewer.is_owner, true);
        assert.equal((await request(api.base, 'GET', '/messes/6', { token: await loginAs(api.base, 'admin@example.com') })).status, 200);
    });

    it('a wrong id gives 404 or 400', async () => {
        assert.equal((await request(api.base, 'GET', '/messes/9999')).status, 404);
        assert.equal((await request(api.base, 'GET', '/messes/abc')).status, 400);
    });

    it('history is only numbers', async () => {
        const result = await request(api.base, 'GET', '/messes/2/history');
        assert.deepEqual(result.body, { established_year: 2016, total_members_ever: 7, current_members: 6 });
    });
});

describe('seats and reviews of a mess', () => {
    let api;
    before(async () => { api = await startServer(); });
    after(async () => { await api.close(); });

    it('the public sees free and taken seats, but not who lives there', async () => {
        const result = await request(api.base, 'GET', '/messes/2/seats');
        assert.equal(result.status, 200);
        // Green Nest has 10 seats, one is switched off and hidden from the public
        assert.deepEqual(result.body.summary, { total: 9, free: 3, booked: 6, inactive: 0 });
        const seats = result.body.rooms.flatMap((room) => room.seats);
        assert.equal(seats.length, 9);
        assert.ok(seats.every((seat) => !('member' in seat)));
        assert.ok(seats.every((seat) => seat.status !== 'inactive'));
    });

    it('the manager of the mess also sees who lives there and the switched off seat', async () => {
        const token = await loginAs(api.base, 'kamal.hossain@example.com');
        const result = await request(api.base, 'GET', '/messes/2/seats', { token });
        assert.deepEqual(result.body.summary, { total: 10, free: 3, booked: 6, inactive: 1 });
        const seats = result.body.rooms.flatMap((room) => room.seats);
        const zahid = seats.find((seat) => seat.member && seat.member.full_name === 'Zahid Hasan');
        assert.ok(zahid);
        assert.equal(zahid.status, 'booked');
    });

    it('another manager does not see the people of this mess', async () => {
        const token = await loginAs(api.base, 'abdur.rahman@example.com');
        const result = await request(api.base, 'GET', '/messes/2/seats', { token });
        assert.equal(result.body.summary.total, 9);
        assert.ok(result.body.rooms.flatMap((room) => room.seats).every((seat) => !('member' in seat)));
    });

    it('lists the reviews with Current member or Ex-member', async () => {
        const result = await request(api.base, 'GET', '/messes/1/reviews');
        assert.equal(result.status, 200);
        assert.equal(result.body.total, 3);
        const byName = Object.fromEntries(result.body.data.map((review) => [review.reviewer_name, review]));
        assert.equal(byName['Rafiul Islam'].reviewer_type, 'Current member');
        assert.equal(byName['Mehedi Hasan'].reviewer_type, 'Ex-member');
        assert.equal(byName['Rafiul Islam'].manager_reply, 'Thank you Rafiul, glad you like it.');
        assert.equal(byName['Mehedi Hasan'].manager_reply, null);
    });

    it('reviews are split into pages', async () => {
        const result = await request(api.base, 'GET', '/messes/1/reviews?limit=2&page=2');
        assert.equal(result.body.data.length, 1);
        assert.equal(result.body.total_pages, 2);
    });

    it('seats of a hidden mess are hidden too', async () => {
        assert.equal((await request(api.base, 'GET', '/messes/6/seats')).status, 404);
        assert.equal((await request(api.base, 'GET', '/messes/6/reviews')).status, 404);
    });
});
