// Tests of /api/manager: the mess, its rooms and its seats.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
    startServer, request, loginAs, registerUser, deleteTestUser, closePool, query, takeSnapshot, restoreSnapshot,
} = require('./helpers');

after(closePool);

const messBody = {
    mess_name: 'Test Nest',
    address: 'House 5, Road 2, Mirpur 12, Dhaka',
    area_id: 1,
    description: 'A mess made by the automated tests',
    mess_type: 'boys',
    rules: 'No smoking',
    established_year: 2022,
    contact_phone: '01711123456',
    contact_whatsapp: '+8801711123456',
    has_meal: true,
    meal_cost_monthly: 2500,
    utility_included: true,
    advance_amount: 3000,
    latitude: 23.81,
    longitude: 90.37,
    facility_ids: [1, 2],
    universities: [{ university_id: 1, distance_km: 8.5 }, { university_id: 2, distance_km: 9 }],
};

describe('who can use the manager routes', () => {
    let api;
    before(async () => { api = await startServer(); });
    after(async () => { await api.close(); });

    it('needs a login and the manager role', async () => {
        assert.equal((await request(api.base, 'GET', '/manager/mess')).status, 401);
        const student = await loginAs(api.base, 'rafiul.islam@example.com');
        assert.equal((await request(api.base, 'GET', '/manager/mess', { token: student })).status, 403);
        const admin = await loginAs(api.base, 'admin@example.com');
        assert.equal((await request(api.base, 'GET', '/manager/rooms-seats', { token: admin })).status, 403);
    });

    it('a manager who has no mess yet is told so', async () => {
        const manager = await registerUser(api.base, 'manager');
        try {
            const result = await request(api.base, 'GET', '/manager/mess', { token: manager.token });
            assert.equal(result.status, 404);
            assert.match(result.body.error, /not created your mess/);
            assert.equal((await request(api.base, 'GET', '/manager/rooms-seats', { token: manager.token })).status, 404);
            assert.equal((await request(api.base, 'POST', '/manager/rooms', { token: manager.token, body: { room_no: '1' } })).status, 404);
        } finally {
            await deleteTestUser(manager.user.user_id);
        }
    });
});

describe('create and change a mess', () => {
    let api, snapshot, manager;
    before(async () => {
        api = await startServer();
        snapshot = await takeSnapshot();
        manager = await registerUser(api.base, 'manager');
    });
    after(async () => {
        await restoreSnapshot(snapshot);
        await deleteTestUser(manager.user.user_id);
        await api.close();
    });

    it('refuses a wrong mess form', async () => {
        const bad = [
            [{ ...messBody, latitude: undefined }, /Latitude/],
            [{ ...messBody, mess_type: 'cats' }, /Mess type/],
            [{ ...messBody, meal_cost_monthly: undefined }, /Meal cost is required/],
            [{ ...messBody, contact_phone: '123' }, /Phone/],
            [{ ...messBody, mess_name: 'A' }, /Mess name/],
            [{ ...messBody, longitude: 500 }, /Longitude/],
            [{ ...messBody, facility_ids: 'wifi' }, /Facilities/],
            [{ ...messBody, universities: [{ university_id: 1 }] }, /Distance/],
        ];
        for (const [body, pattern] of bad) {
            const result = await request(api.base, 'POST', '/manager/mess', { token: manager.token, body });
            assert.equal(result.status, 400, JSON.stringify(result.body));
            assert.match(result.body.error, pattern);
        }
        // an area that does not exist
        const noArea = await request(api.base, 'POST', '/manager/mess', { token: manager.token, body: { ...messBody, area_id: 9999 } });
        assert.equal(noArea.status, 400);
        assert.equal((await query('SELECT COUNT(*) AS n FROM messes WHERE manager_id = ?', [manager.user.user_id]))[0].n, 0);
    });

    it('creates a mess that waits for the admin', async () => {
        const result = await request(api.base, 'POST', '/manager/mess', { token: manager.token, body: messBody });
        assert.equal(result.status, 201);
        assert.equal(result.body.status, 'pending');
        assert.equal(result.body.contact_phone, '8801711123456');
        assert.equal(result.body.contact_whatsapp, '8801711123456');
        assert.equal(result.body.facilities.length, 2);
        assert.equal(result.body.universities.length, 2);
        assert.equal(result.body.manager_id, manager.user.user_id);

        // a trigger told the admin
        const notes = await query("SELECT COUNT(*) AS n FROM notifications WHERE user_id = 1 AND message = 'New mess waiting for verification: Test Nest.'");
        assert.equal(notes[0].n, 1);
    });

    it('a manager can have only one mess', async () => {
        const result = await request(api.base, 'POST', '/manager/mess', { token: manager.token, body: messBody });
        assert.equal(result.status, 409);
        assert.match(result.body.error, /already have a mess/);
    });

    it('the mess is hidden from the public until it is verified, but the owner sees it', async () => {
        const mine = await request(api.base, 'GET', '/manager/mess', { token: manager.token });
        const messId = mine.body.mess_id;
        assert.equal((await request(api.base, 'GET', `/messes/${messId}`)).status, 404);
        const owner = await request(api.base, 'GET', `/messes/${messId}`, { token: manager.token });
        assert.equal(owner.status, 200);
        assert.equal(owner.body.viewer.is_owner, true);
    });

    it('updates the details and replaces the facilities and universities', async () => {
        const result = await request(api.base, 'PUT', '/manager/mess', {
            token: manager.token,
            body: { ...messBody, mess_name: 'Test Nest Two', has_meal: false, facility_ids: [3], universities: [{ university_id: 3, distance_km: 1.2 }] },
        });
        assert.equal(result.status, 200);
        assert.equal(result.body.mess_name, 'Test Nest Two');
        assert.equal(result.body.has_meal, 0);
        assert.equal(result.body.meal_cost_monthly, null);
        assert.deepEqual(result.body.facilities.map((f) => f.facility_id), [3]);
        assert.deepEqual(result.body.universities.map((u) => u.university_id), [3]);
        assert.equal(result.body.status, 'pending');   // the manager cannot change his own status
    });
});

describe('rooms and seats of a new mess', () => {
    let api, snapshot, manager, otherManager, roomId, seatA, seatB;
    before(async () => {
        api = await startServer();
        snapshot = await takeSnapshot();
        manager = await registerUser(api.base, 'manager');
        await request(api.base, 'POST', '/manager/mess', { token: manager.token, body: messBody });
        otherManager = await loginAs(api.base, 'abdur.rahman@example.com');
    });
    after(async () => {
        await restoreSnapshot(snapshot);
        await deleteTestUser(manager.user.user_id);
        await api.close();
    });

    it('creates a room', async () => {
        const result = await request(api.base, 'POST', '/manager/rooms', {
            token: manager.token, body: { room_no: '101', floor_no: 1, has_attached_bath: true },
        });
        assert.equal(result.status, 201);
        assert.equal(result.body.room_no, '101');
        assert.equal(result.body.has_attached_bath, 1);
        assert.equal(result.body.has_balcony, 0);
        assert.equal(result.body.is_active, 1);
        roomId = result.body.room_id;
    });

    it('the same room number cannot be used twice', async () => {
        const result = await request(api.base, 'POST', '/manager/rooms', { token: manager.token, body: { room_no: '101' } });
        assert.equal(result.status, 409);
        assert.match(result.body.error, /room number already exists/);
    });

    it('refuses a wrong room form', async () => {
        for (const body of [{}, { room_no: 'a-room-number-that-is-too-long' }, { room_no: '5', floor_no: 'high' }, { room_no: '5', has_balcony: 'maybe' }]) {
            assert.equal((await request(api.base, 'POST', '/manager/rooms', { token: manager.token, body })).status, 400, JSON.stringify(body));
        }
    });

    it('changes a room', async () => {
        const result = await request(api.base, 'PATCH', `/manager/rooms/${roomId}`, {
            token: manager.token, body: { room_no: '101', floor_no: 2, has_balcony: true },
        });
        assert.equal(result.body.floor_no, 2);
        assert.equal(result.body.has_balcony, 1);
        assert.equal(result.body.has_attached_bath, 0);
    });

    it('creates seats', async () => {
        const a = await request(api.base, 'POST', `/manager/rooms/${roomId}/seats`, { token: manager.token, body: { seat_label: 'A', monthly_rent: 3000 } });
        const b = await request(api.base, 'POST', `/manager/rooms/${roomId}/seats`, { token: manager.token, body: { seat_label: 'B', monthly_rent: 3200 } });
        assert.equal(a.status, 201);
        assert.equal(a.body.status, 'available');
        assert.equal(b.body.monthly_rent, 3200);
        seatA = a.body.seat_id;
        seatB = b.body.seat_id;
    });

    it('the same seat label cannot be used twice in a room', async () => {
        const result = await request(api.base, 'POST', `/manager/rooms/${roomId}/seats`, { token: manager.token, body: { seat_label: 'A', monthly_rent: 3000 } });
        assert.equal(result.status, 409);
    });

    it('refuses a wrong seat form', async () => {
        for (const body of [{ monthly_rent: 3000 }, { seat_label: 'C' }, { seat_label: 'C', monthly_rent: 0 }, { seat_label: 'C', monthly_rent: -5 }]) {
            assert.equal((await request(api.base, 'POST', `/manager/rooms/${roomId}/seats`, { token: manager.token, body })).status, 400, JSON.stringify(body));
        }
    });

    it('a rent change is saved in the rent log by a trigger', async () => {
        const result = await request(api.base, 'PATCH', `/manager/seats/${seatA}/rent`, { token: manager.token, body: { monthly_rent: 3300 } });
        assert.equal(result.body.monthly_rent, 3300);
        const log = await query('SELECT old_rent, new_rent FROM seat_rent_log WHERE seat_id = ?', [seatA]);
        assert.deepEqual(log, [{ old_rent: 3000, new_rent: 3300 }]);
    });

    it('switches a seat off and on again', async () => {
        const off = await request(api.base, 'PATCH', `/manager/seats/${seatB}/deactivate`, { token: manager.token });
        assert.equal(off.body.status, 'inactive');
        assert.equal((await request(api.base, 'PATCH', `/manager/seats/${seatB}/deactivate`, { token: manager.token })).status, 400);

        const on = await request(api.base, 'PATCH', `/manager/seats/${seatB}/activate`, { token: manager.token });
        assert.equal(on.body.status, 'available');
        assert.equal((await request(api.base, 'PATCH', `/manager/seats/${seatB}/activate`, { token: manager.token })).status, 400);
    });

    it('shows the room-wise seats', async () => {
        const result = await request(api.base, 'GET', '/manager/rooms-seats', { token: manager.token });
        assert.equal(result.status, 200);
        assert.deepEqual(result.body.summary, { total: 2, free: 2, booked: 0, inactive: 0 });
        assert.equal(result.body.rooms.length, 1);
        assert.deepEqual(result.body.rooms[0].seats.map((s) => s.seat_label), ['A', 'B']);
    });

    it('switches a room off and on again', async () => {
        const off = await request(api.base, 'PATCH', `/manager/rooms/${roomId}/deactivate`, { token: manager.token });
        assert.equal(off.body.is_active, 0);
        const on = await request(api.base, 'PATCH', `/manager/rooms/${roomId}/activate`, { token: manager.token });
        assert.equal(on.body.is_active, 1);
    });

    it('another manager cannot touch these rooms and seats', async () => {
        assert.equal((await request(api.base, 'PATCH', `/manager/rooms/${roomId}`, { token: otherManager, body: { room_no: 'X' } })).status, 404);
        assert.equal((await request(api.base, 'PATCH', `/manager/rooms/${roomId}/deactivate`, { token: otherManager })).status, 404);
        assert.equal((await request(api.base, 'POST', `/manager/rooms/${roomId}/seats`, { token: otherManager, body: { seat_label: 'Z', monthly_rent: 1000 } })).status, 404);
        assert.equal((await request(api.base, 'PATCH', `/manager/seats/${seatA}/rent`, { token: otherManager, body: { monthly_rent: 1 } })).status, 404);
        assert.equal((await request(api.base, 'PATCH', `/manager/seats/${seatA}/deactivate`, { token: otherManager })).status, 404);
        // and the seat is unchanged
        assert.equal((await query('SELECT monthly_rent FROM seats WHERE seat_id = ?', [seatA]))[0].monthly_rent, 3300);
    });
});

describe('the demo mess of Abdur Rahman', () => {
    let api, snapshot, token;
    before(async () => {
        api = await startServer();
        snapshot = await takeSnapshot();
        token = await loginAs(api.base, 'abdur.rahman@example.com');
    });
    after(async () => {
        await restoreSnapshot(snapshot);
        await api.close();
    });

    it('the room-wise page shows the people', async () => {
        const result = await request(api.base, 'GET', '/manager/rooms-seats', { token });
        assert.deepEqual(result.body.summary, { total: 10, free: 5, booked: 5, inactive: 0 });
        const seats = result.body.rooms.flatMap((room) => room.seats);
        assert.ok(seats.find((seat) => seat.member && seat.member.full_name === 'Rafiul Islam'));
    });

    it('a room with members cannot be switched off', async () => {
        const rooms = await request(api.base, 'GET', '/manager/rooms-seats', { token });
        const room101 = rooms.body.rooms.find((room) => room.room_no === '101');
        const result = await request(api.base, 'PATCH', `/manager/rooms/${room101.room_id}/deactivate`, { token });
        assert.equal(result.status, 409);
        assert.match(result.body.error, /still has members/);
    });

    it('a seat with a member cannot be switched off', async () => {
        const result = await request(api.base, 'PATCH', '/manager/seats/1/deactivate', { token });
        assert.equal(result.status, 409);
        assert.match(result.body.error, /has a member/);
    });

    it('a rent change does not touch the rent the members joined with', async () => {
        // seat 1 has Rafiul (joined at 3000)
        const before = await query('SELECT monthly_rent FROM mess_members WHERE member_id = 1');
        const result = await request(api.base, 'PATCH', '/manager/seats/1/rent', { token, body: { monthly_rent: 3400 } });
        assert.equal(result.body.monthly_rent, 3400);
        const after = await query('SELECT monthly_rent FROM mess_members WHERE member_id = 1');
        assert.equal(after[0].monthly_rent, before[0].monthly_rent);
        await request(api.base, 'PATCH', '/manager/seats/1/rent', { token, body: { monthly_rent: 3000 } });   // put it back
    });
});
