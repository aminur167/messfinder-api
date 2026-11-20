// The newsfeed, the seat wanted posts and the comments.
const router = require('express').Router();
const { authenticate, optionalAuth, requireRole } = require('../middleware/auth');
const newsfeed = require('../controllers/newsfeed.controller');
const comment = require('../controllers/comment.controller');

// /api/newsfeed  (everybody can read it)
router.get('/newsfeed', optionalAuth, newsfeed.feed);

// /api/seat-wanted  (students)
router.post('/seat-wanted', authenticate, requireRole('student'), newsfeed.createSeatWanted);
router.get('/seat-wanted/my', authenticate, requireRole('student'), newsfeed.mySeatWanted);
router.patch('/seat-wanted/:id/close', authenticate, requireRole('student'), newsfeed.closeSeatWanted);

// comments: :type is "vacancy" or "wanted"
router.get('/posts/:type/:id/comments', optionalAuth, comment.list);
router.post('/posts/:type/:id/comments', authenticate, comment.create);
router.delete('/comments/:id', authenticate, comment.remove);

module.exports = router;
