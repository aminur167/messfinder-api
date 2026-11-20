// The vacancy posts of the manager: make a post for the free seats, see his posts, close a post.
const { query, withConnection } = require('../config/db');
const AppError = require('../utils/app-error');
const check = require('../utils/validate');
const { getOwnMess } = require('../utils/find-records');
const { addDetails } = require('./newsfeed.controller');

// One post of the manager, in the same shape as the newsfeed (with its seats)
async function loadPost(messId, postId) {
    const rows = await query(
        "SELECT * FROM v_newsfeed WHERE post_type = 'vacancy' AND mess_id = ? AND post_id = ?",
        [messId, postId]
    );
    return rows.length === 0 ? null : (await addDetails(rows, null))[0];
}

// POST /api/manager/posts
// The procedure sp_create_vacancy_post saves the post and its seats in one transaction.
// Triggers make sure the mess is verified and every seat is a free seat of this mess.
async function createPost(req, res) {
    const body = req.body || {};
    const title = check.text(body.title, 'Title', { min: 3, max: 150 });
    const description = check.optionalText(body.description, 'Description', { max: 2000 });
    const availableFrom = check.date(body.available_from, 'Available from');
    const seatIds = check.integerArray(body.seat_ids, 'Seats', { max: 50 });
    if (seatIds.length === 0) {
        throw new AppError(400, 'Choose at least one seat for the post');
    }

    const mess = await getOwnMess(req.user.id);

    // an OUT parameter (@post_id) lives only in one connection, so we use the same connection for both statements
    const postId = await withConnection(async (connection) => {
        await connection.query(
            'CALL sp_create_vacancy_post(?, ?, ?, ?, ?, @post_id)',
            [req.user.id, title, description, availableFrom, JSON.stringify(seatIds)]
        );
        const [rows] = await connection.query('SELECT @post_id AS post_id');
        return rows[0].post_id;
    });

    res.status(201).json(await loadPost(mess.mess_id, postId));
}

// GET /api/manager/posts?page=1   (newest first, 10 on a page)
async function myPosts(req, res) {
    const mess = await getOwnMess(req.user.id);
    const page = check.integer(req.query.page, 'Page', { fallback: 1, max: 100000 });
    const limit = check.integer(req.query.limit, 'Limit', { fallback: 10, max: 50 });

    const [totalRows, rows] = await Promise.all([
        query(
            "SELECT COUNT(*) AS total FROM vacancy_posts WHERE mess_id = ? AND status <> 'removed'",
            [mess.mess_id]
        ),
        query(
            `SELECT * FROM v_newsfeed
              WHERE post_type = 'vacancy' AND mess_id = ? AND status <> 'removed'
              ORDER BY created_at DESC, post_id DESC
              LIMIT ? OFFSET ?`,
            [mess.mess_id, limit, (page - 1) * limit]
        ),
    ]);
    const total = totalRows[0].total;
    res.json({ data: await addDetails(rows, null), page, limit, total, total_pages: Math.ceil(total / limit) });
}

// PATCH /api/manager/posts/:id/close
async function closePost(req, res) {
    const mess = await getOwnMess(req.user.id);
    const postId = check.integer(req.params.id, 'Post id');

    const post = await loadPost(mess.mess_id, postId);
    if (!post || post.status === 'removed') throw new AppError(404, 'Post not found');
    if (post.status !== 'open') throw new AppError(400, 'This post is not open');

    await query("UPDATE vacancy_posts SET status = 'closed' WHERE post_id = ?", [postId]);
    res.json(await loadPost(mess.mess_id, postId));
}

module.exports = { createPost, myPosts, closePost };
