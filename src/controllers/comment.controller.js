// Comments under the posts of the newsfeed. Both kinds of posts can have comments.
const { query, pool } = require('../config/db');
const AppError = require('../utils/app-error');
const check = require('../utils/validate');

// The address says "vacancy" or "wanted". This list decides which table and column belong to it,
// so the word from the address is never put into the SQL text.
const POST_TYPES = {
    vacancy: { table: 'vacancy_posts', idColumn: 'post_id', commentColumn: 'vacancy_post_id' },
    wanted: { table: 'seat_wanted_posts', idColumn: 'wanted_id', commentColumn: 'wanted_post_id' },
};

// Finds the post of the address, or answers "not found" (also for a removed post).
async function findPost(req) {
    const type = POST_TYPES[req.params.type];
    if (!type) throw new AppError(400, 'Post type must be vacancy or wanted');
    const postId = check.integer(req.params.id, 'Post id');

    const rows = await query(`SELECT status FROM ${type.table} WHERE ${type.idColumn} = ?`, [postId]);
    if (rows.length === 0 || rows[0].status === 'removed') throw new AppError(404, 'Post not found');
    return { type, postId };
}

// The comment in the shape the page needs
async function loadComment(commentId, viewer) {
    const rows = await query(
        `SELECT c.comment_id, c.user_id, u.full_name, u.role, c.body, c.created_at
           FROM post_comments AS c
           JOIN users AS u ON u.user_id = c.user_id
          WHERE c.comment_id = ?`,
        [commentId]
    );
    return withCanDelete(rows, viewer)[0];
}

// Marks the comments the viewer may delete: his own, or any comment for the admin.
function withCanDelete(comments, viewer) {
    return comments.map((comment) => ({
        ...comment,
        can_delete: Boolean(viewer && (viewer.role === 'admin' || viewer.id === comment.user_id)),
    }));
}

// GET /api/posts/:type/:id/comments
async function list(req, res) {
    const { type, postId } = await findPost(req);
    const rows = await query(
        `SELECT c.comment_id, c.user_id, u.full_name, u.role, c.body, c.created_at
           FROM post_comments AS c
           JOIN users AS u ON u.user_id = c.user_id
          WHERE c.${type.commentColumn} = ? AND c.is_deleted = 0
          ORDER BY c.created_at ASC, c.comment_id ASC
          LIMIT 200`,
        [postId]
    );
    res.json(withCanDelete(rows, req.user));
}

// POST /api/posts/:type/:id/comments   { "body": "..." }
// A trigger refuses comments on expired posts and tells the owner of the post about the new comment.
async function create(req, res) {
    const { type, postId } = await findPost(req);
    const body = check.text((req.body || {}).body, 'Comment', { max: 500 });

    const [result] = await pool.query(
        `INSERT INTO post_comments (user_id, ${type.commentColumn}, body) VALUES (?, ?, ?)`,
        [req.user.id, postId, body]
    );
    res.status(201).json(await loadComment(result.insertId, req.user));
}

// DELETE /api/comments/:id
// The comment is not really deleted (soft delete): it is only hidden.
async function remove(req, res) {
    const commentId = check.integer(req.params.id, 'Comment id');
    const rows = await query('SELECT user_id, is_deleted FROM post_comments WHERE comment_id = ?', [commentId]);
    if (rows.length === 0 || rows[0].is_deleted) throw new AppError(404, 'Comment not found');

    if (rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
        throw new AppError(403, 'You can delete only your own comments');
    }
    await query('UPDATE post_comments SET is_deleted = 1 WHERE comment_id = ?', [commentId]);
    res.json({ deleted: true });
}

module.exports = { list, create, remove };
