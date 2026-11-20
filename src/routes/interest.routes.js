// /api/interests  (students)
const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const interest = require('../controllers/interest.controller');

router.use(authenticate, requireRole('student'));

router.post('/toggle', interest.toggle);
router.get('/my', interest.mine);

module.exports = router;
