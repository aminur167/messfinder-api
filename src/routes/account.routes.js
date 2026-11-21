// Things every logged in user has: notifications, and complaints (students and managers).
const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const notification = require('../controllers/notification.controller');
const complaint = require('../controllers/complaint.controller');

// /api/notifications  (keep 'read-all' above ':id')
router.get('/notifications', authenticate, notification.list);
router.patch('/notifications/read-all', authenticate, notification.markAllRead);
router.patch('/notifications/:id/read', authenticate, notification.markRead);

// /api/complaints
router.post('/complaints', authenticate, requireRole('student', 'manager'), complaint.create);
router.get('/complaints/my', authenticate, requireRole('student', 'manager'), complaint.mine);

module.exports = router;
