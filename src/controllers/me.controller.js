// The My mess page of a student: the mess he lives in, his rent and his payments.
// This works only when a manager has linked his account to a member.
const { query } = require('../config/db');
const { loadMemberDetails } = require('../utils/member-details');

// The member row of the student's current mess, or null
async function findActiveMemberId(studentId) {
    const rows = await query(
        "SELECT member_id FROM mess_members WHERE student_id = ? AND status = 'active'",
        [studentId]
    );
    return rows.length === 0 ? null : rows[0].member_id;
}

// GET /api/me/membership
async function membership(req, res) {
    const memberId = await findActiveMemberId(req.user.id);
    if (memberId === null) return res.json({ membership: null });

    const rows = await query(
        `SELECT m.member_id, me.mess_id, me.mess_name, me.contact_phone, me.contact_whatsapp,
                r.room_no, s.seat_label, m.monthly_rent, m.advance_amount, m.join_date
           FROM mess_members AS m
           JOIN seats AS s   ON s.seat_id  = m.seat_id
           JOIN rooms AS r   ON r.room_id  = s.room_id
           JOIN messes AS me ON me.mess_id = r.mess_id
          WHERE m.member_id = ?`,
        [memberId]
    );
    res.json({ membership: rows[0] });
}

// GET /api/me/dues
// The rent of the current mess month by month, with what was paid and what is left.
async function dues(req, res) {
    const memberId = await findActiveMemberId(req.user.id);
    if (memberId === null) {
        return res.json({ membership: null, dues: [], outstanding: 0, current_month_status: null });
    }
    const details = await loadMemberDetails(memberId);
    res.json({
        membership: {
            member_id: details.member.member_id,
            mess_name: details.member.mess_name,
            room_no: details.member.room_no,
            seat_label: details.member.seat_label,
            monthly_rent: details.member.monthly_rent,
            join_date: details.member.join_date,
        },
        dues: details.dues,
        outstanding: details.outstanding,
        current_month_status: details.current_month_status,
    });
}

// GET /api/me/payments
// Every payment of the student, also from messes he lived in before (newest first).
async function payments(req, res) {
    res.json(await query(
        `SELECT p.payment_id, me.mess_name, p.due_id, d.due_month, p.amount, p.payment_type, p.method, p.paid_at
           FROM payments AS p
           JOIN mess_members AS m ON m.member_id = p.member_id
           JOIN seats AS s   ON s.seat_id  = m.seat_id
           JOIN rooms AS r   ON r.room_id  = s.room_id
           JOIN messes AS me ON me.mess_id = r.mess_id
           LEFT JOIN rent_dues AS d ON d.due_id = p.due_id
          WHERE m.student_id = ?
          ORDER BY p.paid_at DESC, p.payment_id DESC
          LIMIT 200`,
        [req.user.id]
    ));
}

module.exports = { membership, dues, payments };
