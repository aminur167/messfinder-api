// /api/conversations  (students and managers)
const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const chat = require('../controllers/chat.controller');

router.use(authenticate, requireRole('student', 'manager'));

router.post('/', chat.open);
router.get('/', chat.inbox);
router.get('/unread-count', chat.unreadCount);   // keep this above '/:id'
router.get('/:id/messages', chat.messages);
router.post('/:id/messages', chat.send);
router.patch('/:id/read', chat.read);

module.exports = router;
