// The Interested button: the list of a student, and the list the manager sees.
const { query, withConnection } = require('../config/db');
const check = require('../utils/validate');
const { getOwnMess } = require('../utils/find-records');

// POST /api/interests/toggle   { "mess_id": 1, "post_id": 3 }   (post_id is optional)
// First press adds the mess to the student's list, the second press removes it.
async function toggle(req, res) {
    const body = req.body || {};
    const messId = check.integer(body.mess_id, 'Mess');
    const postId = body.post_id === undefined || body.post_id === null ? null : check.integer(body.post_id, 'Post');

    // the procedure gives its answer in an OUT parameter, so both statements share one connection
    const isInterested = await withConnection(async (connection) => {
        await connection.query('CALL sp_toggle_interest(?, ?, ?, @is_interested)', [req.user.id, messId, postId]);
        const [rows] = await connection.query('SELECT @is_interested AS is_interested');
        return rows[0].is_interested === 1;
    });

    res.json({ mess_id: messId, is_interested: isInterested });
}

// GET /api/interests/my
// The messes the student marked, newest first, with the chat if there is one.
async function mine(req, res) {
    const rows = await query(
        `SELECT ms.mess_id, ms.mess_name, ms.mess_type, ms.address, ms.area_id, ms.area_name,
                ms.total_seats, ms.free_seats, ms.min_rent, ms.max_rent, ms.avg_rating, ms.review_count,
                i.created_at AS interested_at, c.conversation_id
           FROM interests AS i
           JOIN v_mess_summary AS ms ON ms.mess_id = i.mess_id
           LEFT JOIN conversations AS c ON c.mess_id = i.mess_id AND c.student_id = i.student_id
          WHERE i.student_id = ?
          ORDER BY i.created_at DESC`,
        [req.user.id]
    );
    res.json(rows);
}

// GET /api/manager/interests
// The students who are interested in the mess of the manager, newest first.
async function forManager(req, res) {
    const mess = await getOwnMess(req.user.id);
    const page = check.integer(req.query.page, 'Page', { fallback: 1, max: 100000 });
    const limit = check.integer(req.query.limit, 'Limit', { fallback: 20, max: 50 });

    const totalRows = await query('SELECT COUNT(*) AS total FROM interests WHERE mess_id = ?', [mess.mess_id]);
    const rows = await query(
        `SELECT u.user_id AS student_id, u.full_name, u.phone, sp.gender, sp.department,
                un.short_name AS university, i.created_at AS interested_at,
                i.post_id, vp.title AS post_title, c.conversation_id
           FROM interests AS i
           JOIN users AS u ON u.user_id = i.student_id
           JOIN student_profiles AS sp ON sp.student_id = i.student_id
           JOIN universities AS un ON un.university_id = sp.university_id
           LEFT JOIN vacancy_posts AS vp ON vp.post_id = i.post_id
           LEFT JOIN conversations AS c ON c.mess_id = i.mess_id AND c.student_id = i.student_id
          WHERE i.mess_id = ?
          ORDER BY i.created_at DESC
          LIMIT ? OFFSET ?`,
        [mess.mess_id, limit, (page - 1) * limit]
    );

    const total = totalRows[0].total;
    res.json({ data: rows, page, limit, total, total_pages: Math.ceil(total / limit) });
}

module.exports = { toggle, mine, forManager };
