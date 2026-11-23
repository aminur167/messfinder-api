// All the API routes. Every address starts with /api.
const router = require('express').Router();
const { query } = require('../config/db');

router.use('/auth', require('./auth.routes'));
router.use('/messes', require('./mess.routes'));
router.use('/reference', require('./reference.routes'));
router.use('/manager', require('./manager.routes'));
router.use('/admin', require('./admin.routes'));
router.use('/interests', require('./interest.routes'));
router.use('/conversations', require('./chat.routes'));
router.use('/', require('./newsfeed.routes'));   // /newsfeed, /seat-wanted, /posts/.../comments, /comments/:id
router.use('/', require('./student.routes'));    // /me/..., /reviews, /visits
router.use('/', require('./account.routes'));    // /notifications, /complaints

// GET /api/health: is the server up and can it reach MySQL?
router.get('/health', async (req, res) => {
    await query('SELECT 1');
    res.json({ status: 'ok' });
});

module.exports = router;
