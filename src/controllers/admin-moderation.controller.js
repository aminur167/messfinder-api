// The Moderation page of the admin: take down posts that break the rules, see the latest comments.
// Posts and comments are hidden, never deleted (soft delete).
const { query } = require('../config/db');
const AppError = require('../utils/app-error');
const check = require('../utils/validate');

// The word in the address decides the table. This list is the only place the table names come from.
const POST_TYPES = {
    vacancy: { table: 'vacancy_posts', idColumn: 'post_id' },
    wanted: { table: 'seat_wanted_posts', idColumn: 'wanted_id' },
};

function postType(word) {
    const type = POST_TYPES[word];
    if (!type) throw new AppError(400, 'Post type must be vacancy or wanted');
    return type;
}

// GET /api/admin/posts?type=vacancy&status=open&page=1
// All posts of one kind, in every status.
async function posts(req, res) {
    const q = req.query;
    const page = check.integer(q.page, 'Page', { fallback: 1, max: 100000 });
    const limit = check.integer(q.limit, 'Limit', { fallback: 20, max: 100 });
    const wanted = check.oneOf(q.type === undefined ? 'vacancy' : q.type, 'Type', ['vacancy', 'wanted']) === 'wanted';
    const status = q.status === undefined ? null : check.oneOf(q.status, 'Status', ['open', 'closed', 'expired', 'removed']);
    const condition = status === null ? '1 = 1' : 'p.status = ?';
    const params = status === null ? [] : [status];

    let totalSql, rowsSql;
    if (wanted) {
        totalSql = `SELECT COUNT(*) AS total FROM seat_wanted_posts AS p WHERE ${condition}`;
        rowsSql = `SELECT p.wanted_id AS post_id, p.title, p.description, p.status, p.created_at,
                          u.user_id AS author_id, u.full_name AS author_name,
                          (SELECT COUNT(*) FROM post_comments AS c WHERE c.wanted_post_id = p.wanted_id AND c.is_deleted = 0) AS comment_count
                     FROM seat_wanted_posts AS p
                     JOIN users AS u ON u.user_id = p.student_id
                    WHERE ${condition}
                    ORDER BY p.created_at DESC, p.wanted_id DESC
                    LIMIT ? OFFSET ?`;
    } else {
        totalSql = `SELECT COUNT(*) AS total FROM vacancy_posts AS p WHERE ${condition}`;
        rowsSql = `SELECT p.post_id, p.title, p.description, p.status, p.created_at,
                          me.manager_id AS author_id, me.mess_name AS author_name,
                          (SELECT COUNT(*) FROM post_comments AS c WHERE c.vacancy_post_id = p.post_id AND c.is_deleted = 0) AS comment_count
                     FROM vacancy_posts AS p
                     JOIN messes AS me ON me.mess_id = p.mess_id
                    WHERE ${condition}
                    ORDER BY p.created_at DESC, p.post_id DESC
                    LIMIT ? OFFSET ?`;
    }

    const [totalRows, rows] = await Promise.all([
        query(totalSql, params),
        query(rowsSql, [...params, limit, (page - 1) * limit]),
    ]);
    const total = totalRows[0].total;
    res.json({ data: rows, page, limit, total, total_pages: Math.ceil(total / limit) });
}

// PATCH /api/admin/posts/:type/:id/remove
async function removePost(req, res) {
    const type = postType(req.params.type);
    const postId = check.integer(req.params.id, 'Post id');

    const rows = await query(`SELECT status FROM ${type.table} WHERE ${type.idColumn} = ?`, [postId]);
    if (rows.length === 0) throw new AppError(404, 'Post not found');
    if (rows[0].status === 'removed') throw new AppError(400, 'This post is already removed');

    await query(`UPDATE ${type.table} SET status = 'removed' WHERE ${type.idColumn} = ?`, [postId]);
    res.json({ post_id: postId, status: 'removed' });
}

// GET /api/admin/comments?page=1
// The newest comments (not deleted), with the post they belong to. The admin removes one with DELETE /comments/:id.
async function comments(req, res) {
    const page = check.integer(req.query.page, 'Page', { fallback: 1, max: 100000 });
    const limit = check.integer(req.query.limit, 'Limit', { fallback: 20, max: 100 });

    const [totalRows, rows] = await Promise.all([
        query('SELECT COUNT(*) AS total FROM post_comments WHERE is_deleted = 0'),
        query(
            `SELECT c.comment_id, c.body, c.created_at, u.user_id, u.full_name, u.role,
                    IF(c.vacancy_post_id IS NOT NULL, 'vacancy', 'wanted') AS post_type,
                    COALESCE(c.vacancy_post_id, c.wanted_post_id) AS post_id,
                    COALESCE(vp.title, wp.title) AS post_title
               FROM post_comments AS c
               JOIN users AS u ON u.user_id = c.user_id
               LEFT JOIN vacancy_posts AS vp ON vp.post_id = c.vacancy_post_id
               LEFT JOIN seat_wanted_posts AS wp ON wp.wanted_id = c.wanted_post_id
              WHERE c.is_deleted = 0
              ORDER BY c.created_at DESC, c.comment_id DESC
              LIMIT ? OFFSET ?`,
            [limit, (page - 1) * limit]
        ),
    ]);
    const total = totalRows[0].total;
    res.json({ data: rows, page, limit, total, total_pages: Math.ceil(total / limit) });
}

module.exports = { posts, removePost, comments };
