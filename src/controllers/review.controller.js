// Reviews: a member (or ex-member) writes one, the manager reads them and replies.
const { query, pool } = require('../config/db');
const AppError = require('../utils/app-error');
const check = require('../utils/validate');
const { getOwnMess } = require('../utils/find-records');
const { listReviews } = require('../utils/review-queries');

// An optional rating from 1 to 5. Returns null when it was not sent.
function optionalRating(value, name) {
    return check.optionalInteger(value, name, { min: 1, max: 5 });
}

// POST /api/reviews
// { "mess_id": 1, "rating": 4, "cleanliness_rating": 4, "safety_rating": 5, "food_rating": 3, "comment": "..." }
// A trigger checks that the student lived in the mess. One review per student and mess (UNIQUE key).
async function create(req, res) {
    const body = req.body || {};
    const [result] = await pool.query(
        `INSERT INTO reviews (mess_id, student_id, rating, cleanliness_rating, safety_rating, food_rating, comment)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            check.integer(body.mess_id, 'Mess'),
            req.user.id,
            check.integer(body.rating, 'Rating', { min: 1, max: 5 }),
            optionalRating(body.cleanliness_rating, 'Cleanliness rating'),
            optionalRating(body.safety_rating, 'Safety rating'),
            optionalRating(body.food_rating, 'Food rating'),
            check.optionalText(body.comment, 'Comment', { max: 500 }),
        ]
    );
    const rows = await query('SELECT * FROM reviews WHERE review_id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
}

// GET /api/manager/reviews?page=1
async function forManager(req, res) {
    const mess = await getOwnMess(req.user.id);
    const page = check.integer(req.query.page, 'Page', { fallback: 1, max: 100000 });
    const limit = check.integer(req.query.limit, 'Limit', { fallback: 10, max: 50 });
    res.json(await listReviews(mess.mess_id, page, limit));
}

// PATCH /api/manager/reviews/:id/reply   { "reply": "Thank you!" }
// A review gets one reply.
async function reply(req, res) {
    const mess = await getOwnMess(req.user.id);
    const reviewId = check.integer(req.params.id, 'Review id');
    const text = check.text((req.body || {}).reply, 'Reply', { max: 500 });

    const rows = await query('SELECT manager_reply FROM reviews WHERE review_id = ? AND mess_id = ?', [reviewId, mess.mess_id]);
    if (rows.length === 0) throw new AppError(404, 'Review not found');
    if (rows[0].manager_reply !== null) throw new AppError(409, 'You have already replied to this review');

    await query('UPDATE reviews SET manager_reply = ?, replied_at = NOW() WHERE review_id = ?', [text, reviewId]);
    const updated = await query('SELECT review_id, manager_reply, replied_at FROM reviews WHERE review_id = ?', [reviewId]);
    res.json(updated[0]);
}

module.exports = { create, forManager, reply };
