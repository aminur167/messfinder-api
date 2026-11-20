// /api/messes  (open to everybody; a logged in user sees a little more)
const router = require('express').Router();
const { optionalAuth } = require('../middleware/auth');
const mess = require('../controllers/mess.controller');

router.use(optionalAuth);

router.get('/', mess.list);
router.get('/nearby', mess.nearby);       // keep this above '/:id'
router.get('/:id', mess.details);
router.get('/:id/history', mess.history);
router.get('/:id/seats', mess.seats);
router.get('/:id/reviews', mess.reviews);

module.exports = router;
