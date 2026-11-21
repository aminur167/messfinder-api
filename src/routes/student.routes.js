// The student's own pages: My mess, reviews and visit requests.
const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const me = require('../controllers/me.controller');
const review = require('../controllers/review.controller');
const visit = require('../controllers/visit.controller');

const studentOnly = [authenticate, requireRole('student')];

// /api/me  (a student's mess, rent and payments)
router.get('/me/membership', ...studentOnly, me.membership);
router.get('/me/dues', ...studentOnly, me.dues);
router.get('/me/payments', ...studentOnly, me.payments);

// /api/reviews
router.post('/reviews', ...studentOnly, review.create);

// /api/visits
router.post('/visits', ...studentOnly, visit.create);
router.get('/visits/my', ...studentOnly, visit.mine);
router.patch('/visits/:id/cancel', ...studentOnly, visit.cancel);

module.exports = router;
