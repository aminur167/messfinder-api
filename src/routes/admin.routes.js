// /api/admin  (only for the admin)
const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const verification = require('../controllers/admin-verification.controller');
const users = require('../controllers/admin-user.controller');
const complaints = require('../controllers/admin-complaint.controller');
const moderation = require('../controllers/admin-moderation.controller');
const reports = require('../controllers/admin-report.controller');

router.use(authenticate, requireRole('admin'));

router.get('/dashboard', reports.dashboard);
router.get('/reports', reports.reports);

// verification
router.get('/pending', verification.pending);
router.patch('/managers/:id/verify', verification.verifyManager);
router.patch('/messes/:id/verify', verification.verifyMess);
router.patch('/messes/:id/suspend', verification.suspendMess);

// users
router.get('/users', users.list);
router.patch('/users/:id/block', users.setBlocked(true));
router.patch('/users/:id/unblock', users.setBlocked(false));

// complaints
router.get('/complaints', complaints.list);
router.patch('/complaints/:id', complaints.update);

// moderation
router.get('/posts', moderation.posts);
router.patch('/posts/:type/:id/remove', moderation.removePost);
router.get('/comments', moderation.comments);

module.exports = router;
