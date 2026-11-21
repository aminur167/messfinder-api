// The Members page of the manager: who lives in the mess, who owes rent, adding a member,
// recording payments. The hard work (transaction, lock, checks) is done by the procedures
// sp_add_member, sp_mark_member_left and sp_record_payment.
const { query, withConnection } = require('../config/db');
const AppError = require('../utils/app-error');
const check = require('../utils/validate');
const { getOwnMess } = require('../utils/find-records');
const { loadMemberDetails } = require('../utils/member-details');

const METHODS = ['cash', 'bkash', 'nagad'];

// A member, only if he belongs to the manager's mess
async function getOwnMemberId(messId, memberId) {
    const rows = await query(
        `SELECT m.member_id
           FROM mess_members AS m
           JOIN seats AS s ON s.seat_id = m.seat_id
           JOIN rooms AS r ON r.room_id = s.room_id
          WHERE m.member_id = ? AND r.mess_id = ?`,
        [memberId, messId]
    );
    if (rows.length === 0) throw new AppError(404, 'Member not found');
    return rows[0].member_id;
}

// GET /api/manager/members?status=active&month_status=overdue&with_dues=1&q=rafi&sort=outstanding&page=1
// The list of the Members page. "summary" counts the active members by the status of this month's rent,
// for the filter chips (All, Paid, Partial, Due, Overdue).
async function list(req, res) {
    const mess = await getOwnMess(req.user.id);
    const q = req.query;
    const page = check.integer(q.page, 'Page', { fallback: 1, max: 100000 });
    const limit = check.integer(q.limit, 'Limit', { fallback: 20, max: 100 });

    const where = ['v.mess_id = ?', 'v.member_status = ?'];
    const params = [mess.mess_id, q.status === undefined ? 'active' : check.oneOf(q.status, 'Status', ['active', 'left'])];

    if (q.month_status !== undefined) {
        where.push('v.current_month_status = ?');
        params.push(check.oneOf(q.month_status, 'Month status', ['paid', 'partial', 'due', 'overdue']));
    }
    if (q.with_dues === '1' || q.with_dues === 'true') where.push('v.outstanding > 0');
    if (q.q !== undefined && String(q.q).trim() !== '') {
        const like = `%${String(q.q).trim().replace(/[\\%_]/g, '\\$&')}%`;
        where.push("(v.full_name LIKE ? OR v.phone LIKE ? OR CONCAT(v.room_no, '-', v.seat_label) LIKE ?)");
        params.push(like, like, like);
    }

    // the sort comes from this list, never from the address
    const sorts = {
        room: 'v.room_no, v.seat_label',
        outstanding: 'v.outstanding DESC, v.full_name',
        name: 'v.full_name',
        joined: 'v.join_date DESC',
    };
    const sort = q.sort === undefined ? 'room' : check.oneOf(q.sort, 'Sort', Object.keys(sorts));

    const condition = where.join(' AND ');
    const [totalRows, rows, summary] = await Promise.all([
        query(`SELECT COUNT(*) AS total FROM v_member_dues AS v WHERE ${condition}`, params),
        query(
            `SELECT v.member_id, v.full_name, v.phone, v.student_id, (v.student_id IS NOT NULL) AS is_linked,
                    v.room_no, v.seat_label, v.monthly_rent, v.member_status, v.join_date, v.leave_date,
                    v.total_due, v.total_paid, v.outstanding, v.overdue_count, v.current_month_status
               FROM v_member_dues AS v
              WHERE ${condition}
              ORDER BY ${sorts[sort]}
              LIMIT ? OFFSET ?`,
            [...params, limit, (page - 1) * limit]
        ),
        query(
            `SELECT COUNT(*) AS total,
                    COALESCE(SUM(current_month_status = 'paid'), 0)    AS paid,
                    COALESCE(SUM(current_month_status = 'partial'), 0) AS partial,
                    COALESCE(SUM(current_month_status = 'due'), 0)     AS due,
                    COALESCE(SUM(current_month_status = 'overdue'), 0) AS overdue,
                    COALESCE(SUM(current_month_status IS NULL), 0)     AS none
               FROM v_member_dues
              WHERE mess_id = ? AND member_status = 'active'`,
            [mess.mess_id]
        ),
    ]);

    const total = totalRows[0].total;
    res.json({ data: rows, page, limit, total, total_pages: Math.ceil(total / limit), summary: summary[0] });
}

// GET /api/manager/members/ex
// The Ex-members tab: everything about the people who left. Only the manager sees this.
async function exMembers(req, res) {
    const mess = await getOwnMess(req.user.id);
    const page = check.integer(req.query.page, 'Page', { fallback: 1, max: 100000 });
    const limit = check.integer(req.query.limit, 'Limit', { fallback: 20, max: 100 });

    const totalRows = await query(
        `SELECT COUNT(*) AS total
           FROM mess_members AS m
           JOIN seats AS s ON s.seat_id = m.seat_id
           JOIN rooms AS r ON r.room_id = s.room_id
          WHERE r.mess_id = ? AND m.status = 'left'`,
        [mess.mess_id]
    );
    const rows = await query(
        `SELECT m.member_id, m.full_name, m.phone, m.occupation, (m.student_id IS NOT NULL) AS is_linked,
                r.room_no, s.seat_label, m.monthly_rent, m.advance_amount, m.join_date, m.leave_date,
                TIMESTAMPDIFF(MONTH, m.join_date, m.leave_date) AS months_stayed,
                DATEDIFF(m.leave_date, m.join_date)             AS days_stayed,
                (SELECT COALESCE(SUM(p.amount), 0) FROM payments AS p WHERE p.member_id = m.member_id) AS total_paid,
                fn_member_outstanding(m.member_id)              AS outstanding
           FROM mess_members AS m
           JOIN seats AS s ON s.seat_id = m.seat_id
           JOIN rooms AS r ON r.room_id = s.room_id
          WHERE r.mess_id = ? AND m.status = 'left'
          ORDER BY m.leave_date DESC, m.member_id DESC
          LIMIT ? OFFSET ?`,
        [mess.mess_id, limit, (page - 1) * limit]
    );

    const total = totalRows[0].total;
    res.json({ data: rows, page, limit, total, total_pages: Math.ceil(total / limit) });
}

// GET /api/manager/members/:id
// The Details drawer: the member, every due with what was paid, every payment.
async function details(req, res) {
    const mess = await getOwnMess(req.user.id);
    const memberId = await getOwnMemberId(mess.mess_id, check.integer(req.params.id, 'Member id'));
    res.json(await loadMemberDetails(memberId));
}

// POST /api/manager/members
// Gives a seat to a person (this is the "booking"). Send student_id to link a student account,
// then name, phone and gender come from the account. Without an account they are required.
async function add(req, res) {
    const body = req.body || {};

    const seatId = check.integer(body.seat_id, 'Seat');
    const studentId = check.optionalInteger(body.student_id, 'Student');

    let fullName = null;
    let phone = null;
    let gender = null;
    if (studentId === null) {
        fullName = check.text(body.full_name, 'Full name', { min: 2, max: 100 });
        phone = check.phone(body.phone);
        gender = check.oneOf(body.gender, 'Gender', ['male', 'female']);
    }

    const joinDate = check.date(body.join_date, 'Join date');
    const inRange = await query(
        'SELECT (? BETWEEN DATE_SUB(CURDATE(), INTERVAL 1 YEAR) AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)) AS ok',
        [joinDate]
    );
    if (!inRange[0].ok) throw new AppError(400, 'Join date must be within the last year or the next 60 days');

    const rent = check.optionalNumber(body.monthly_rent, 'Monthly rent', { min: 1, max: 1000000 });
    const advance = check.optionalNumber(body.advance_amount, 'Advance', { max: 1000000 }) ?? 0;
    const method = check.oneOf(body.payment_method === undefined ? 'cash' : body.payment_method, 'Payment method', METHODS);

    // the OUT parameter lives in one connection, so both statements use the same one
    const memberId = await withConnection(async (connection) => {
        await connection.query(
            'CALL sp_add_member(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @member_id)',
            [req.user.id, seatId, studentId, fullName, phone, gender,
             check.optionalText(body.occupation, 'Occupation', { max: 100 }),
             rent === undefined ? null : rent, advance, method, joinDate]
        );
        const [rows] = await connection.query('SELECT @member_id AS member_id');
        return rows[0].member_id;
    });

    res.status(201).json(await loadMemberDetails(memberId));
}

// PATCH /api/manager/members/:id/leave   { "leave_date": "2026-12-01" }  (today when missing)
async function leave(req, res) {
    const mess = await getOwnMess(req.user.id);
    const memberId = await getOwnMemberId(mess.mess_id, check.integer(req.params.id, 'Member id'));
    const body = req.body || {};
    const leaveDate = body.leave_date === undefined
        ? (await query('SELECT CURDATE() AS today'))[0].today
        : check.date(body.leave_date, 'Leave date');

    await query('CALL sp_mark_member_left(?, ?, ?)', [req.user.id, memberId, leaveDate]);
    res.json(await loadMemberDetails(memberId));
}

// GET /api/manager/students/search?q=rafsan
// Finds student accounts by name, email or phone, to link one to a new member.
async function searchStudents(req, res) {
    const mess = await getOwnMess(req.user.id);
    const word = check.text(String(req.query.q ?? ''), 'Search word', { min: 3, max: 50 });
    const like = `%${word.replace(/[\\%_]/g, '\\$&')}%`;
    const wantedGender = mess.mess_type === 'boys' ? 'male' : 'female';

    const rows = await query(
        `SELECT u.user_id, u.full_name, u.email, u.phone, sp.gender, sp.department,
                un.short_name AS university,
                (sp.gender = ?) AS gender_ok,
                EXISTS (SELECT 1 FROM mess_members AS m
                         WHERE m.student_id = u.user_id AND m.status = 'active') AS already_in_a_mess
           FROM users AS u
           JOIN student_profiles AS sp ON sp.student_id = u.user_id
           JOIN universities AS un ON un.university_id = sp.university_id
          WHERE u.role = 'student' AND u.is_active = 1
            AND (u.email LIKE ? OR u.phone LIKE ? OR u.full_name LIKE ?)
          ORDER BY u.full_name
          LIMIT 10`,
        [wantedGender, like, like, like]
    );
    res.json(rows);
}

// POST /api/manager/payments   { "member_id": 3, "due_id": 12, "amount": 1000, "method": "bkash" }
// due_id is missing for an advance payment. A due can be paid in parts.
async function recordPayment(req, res) {
    const body = req.body || {};
    const memberId = check.integer(body.member_id, 'Member');
    const dueId = check.optionalInteger(body.due_id, 'Due');
    const amount = check.number(body.amount, 'Amount', { min: 1, max: 10000000 });
    const method = check.oneOf(body.method, 'Payment method', METHODS);
    const paidAt = body.paid_at === undefined || body.paid_at === null ? null : check.dateTime(body.paid_at, 'Paid at');

    const paymentId = await withConnection(async (connection) => {
        await connection.query(
            'CALL sp_record_payment(?, ?, ?, ?, ?, ?, @payment_id)',
            [req.user.id, memberId, dueId, amount, method, paidAt]
        );
        const [rows] = await connection.query('SELECT @payment_id AS payment_id');
        return rows[0].payment_id;
    });

    const payment = (await query(
        'SELECT payment_id, member_id, due_id, amount, payment_type, method, paid_at FROM payments WHERE payment_id = ?',
        [paymentId]
    ))[0];
    const due = dueId === null ? null : (await query(
        `SELECT d.due_id, d.due_month, d.amount, d.status,
                d.amount - COALESCE((SELECT SUM(p.amount) FROM payments AS p WHERE p.due_id = d.due_id), 0) AS remaining
           FROM rent_dues AS d WHERE d.due_id = ?`, [dueId]
    ))[0];

    res.status(201).json({ payment, due });
}

// GET /api/manager/payments?member_id=3&page=1   (newest first)
async function payments(req, res) {
    const mess = await getOwnMess(req.user.id);
    const page = check.integer(req.query.page, 'Page', { fallback: 1, max: 100000 });
    const limit = check.integer(req.query.limit, 'Limit', { fallback: 20, max: 100 });

    const where = ['r.mess_id = ?'];
    const params = [mess.mess_id];
    if (req.query.member_id !== undefined) {
        where.push('p.member_id = ?');
        params.push(check.integer(req.query.member_id, 'Member'));
    }
    const condition = where.join(' AND ');
    const from = `FROM payments AS p
                  JOIN mess_members AS m ON m.member_id = p.member_id
                  JOIN seats AS s ON s.seat_id = m.seat_id
                  JOIN rooms AS r ON r.room_id = s.room_id
                  WHERE ${condition}`;

    const totalRows = await query(`SELECT COUNT(*) AS total ${from}`, params);
    const rows = await query(
        `SELECT p.payment_id, p.member_id, m.full_name, r.room_no, s.seat_label, p.due_id,
                p.amount, p.payment_type, p.method, p.paid_at
         ${from}
         ORDER BY p.paid_at DESC, p.payment_id DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, (page - 1) * limit]
    );

    const total = totalRows[0].total;
    res.json({ data: rows, page, limit, total, total_pages: Math.ceil(total / limit) });
}

// GET /api/manager/dues?status=overdue&month=2026-11&member_id=3&page=1
// Every monthly due of the mess with what was paid and what is left.
async function dues(req, res) {
    const mess = await getOwnMess(req.user.id);
    const q = req.query;
    const page = check.integer(q.page, 'Page', { fallback: 1, max: 100000 });
    const limit = check.integer(q.limit, 'Limit', { fallback: 20, max: 100 });

    const where = ['r.mess_id = ?'];
    const params = [mess.mess_id];
    if (q.status !== undefined) {
        where.push('d.status = ?');
        params.push(check.oneOf(q.status, 'Status', ['due', 'partial', 'paid', 'overdue']));
    }
    if (q.member_id !== undefined) {
        where.push('d.member_id = ?');
        params.push(check.integer(q.member_id, 'Member'));
    }
    if (q.month !== undefined) {
        if (!/^\d{4}-\d{2}$/.test(q.month)) throw new AppError(400, 'Month must look like 2026-11');
        where.push('d.due_month = ?');
        params.push(check.date(`${q.month}-01`, 'Month'));
    }

    const from = `FROM rent_dues AS d
                  JOIN mess_members AS m ON m.member_id = d.member_id
                  JOIN seats AS s ON s.seat_id = m.seat_id
                  JOIN rooms AS r ON r.room_id = s.room_id
                  LEFT JOIN (SELECT due_id, SUM(amount) AS paid FROM payments
                              WHERE due_id IS NOT NULL GROUP BY due_id) AS p ON p.due_id = d.due_id
                  WHERE ${where.join(' AND ')}`;

    const totalRows = await query(`SELECT COUNT(*) AS total ${from}`, params);
    const rows = await query(
        `SELECT d.due_id, d.member_id, m.full_name, r.room_no, s.seat_label, d.due_month, d.amount, d.due_date,
                d.status, COALESCE(p.paid, 0) AS paid, d.amount - COALESCE(p.paid, 0) AS remaining
         ${from}
         ORDER BY d.due_month DESC, r.room_no, s.seat_label
         LIMIT ? OFFSET ?`,
        [...params, limit, (page - 1) * limit]
    );

    const total = totalRows[0].total;
    res.json({ data: rows, page, limit, total, total_pages: Math.ceil(total / limit) });
}

// GET /api/manager/dues/overdue
// Dues where nothing was paid after the deadline, the longest overdue first.
async function overdue(req, res) {
    const mess = await getOwnMess(req.user.id);
    res.json(await query(
        `SELECT due_id, member_id, full_name, phone, room_no, seat_label, due_month, amount, due_date, days_late
           FROM v_overdue_dues
          WHERE mess_id = ?
          ORDER BY days_late DESC, full_name`,
        [mess.mess_id]
    ));
}

module.exports = { list, exMembers, details, add, leave, searchStudents, recordPayment, payments, dues, overdue };
