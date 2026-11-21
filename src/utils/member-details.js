// Everything about one member: the person, every monthly due with what was paid for it,
// and every payment. The manager's Details drawer and the student's My mess page both use it.
const { query } = require('../config/db');

async function loadMemberDetails(memberId) {
    const members = await query(
        `SELECT m.member_id, m.student_id, m.full_name, m.phone, m.gender, m.occupation, m.monthly_rent,
                m.advance_amount, m.join_date, m.leave_date, m.status,
                r.mess_id, me.mess_name, r.room_no, s.seat_label, s.seat_id
           FROM mess_members AS m
           JOIN seats AS s   ON s.seat_id  = m.seat_id
           JOIN rooms AS r   ON r.room_id  = s.room_id
           JOIN messes AS me ON me.mess_id = r.mess_id
          WHERE m.member_id = ?`,
        [memberId]
    );
    if (members.length === 0) return null;

    const dues = await query(
        `SELECT d.due_id, d.due_month, d.amount, d.due_date, d.status,
                COALESCE(SUM(p.amount), 0)            AS paid,
                d.amount - COALESCE(SUM(p.amount), 0) AS remaining
           FROM rent_dues AS d
           LEFT JOIN payments AS p ON p.due_id = d.due_id
          WHERE d.member_id = ?
          GROUP BY d.due_id, d.due_month, d.amount, d.due_date, d.status
          ORDER BY d.due_month DESC`,
        [memberId]
    );

    const payments = await query(
        `SELECT payment_id, due_id, amount, payment_type, method, paid_at
           FROM payments
          WHERE member_id = ?
          ORDER BY paid_at DESC, payment_id DESC`,
        [memberId]
    );

    // the money still owed, and the first day of this month by the clock of the database
    const money = await query(
        "SELECT fn_member_outstanding(?) AS outstanding, DATE_FORMAT(CURDATE(), '%Y-%m-01') AS month_start",
        [memberId]
    );
    const thisMonth = dues.find((due) => due.due_month === money[0].month_start);

    return {
        member: { ...members[0], is_linked: members[0].student_id !== null },
        dues,
        payments,
        outstanding: money[0].outstanding,
        current_month_status: thisMonth ? thisMonth.status : null,
    };
}

module.exports = { loadMemberDetails };
