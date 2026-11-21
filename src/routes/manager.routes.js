// /api/manager  (only for logged in managers)
const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const messSetup = require('../controllers/manager-mess.controller');
const vacancyPost = require('../controllers/vacancy-post.controller');
const interest = require('../controllers/interest.controller');
const members = require('../controllers/manager-member.controller');
const dashboard = require('../controllers/manager-dashboard.controller');
const visit = require('../controllers/visit.controller');
const review = require('../controllers/review.controller');

router.use(authenticate, requireRole('manager'));

// the mess
router.post('/mess', messSetup.createMess);
router.get('/mess', messSetup.getMess);
router.put('/mess', messSetup.updateMess);

// rooms
router.post('/rooms', messSetup.createRoom);
router.patch('/rooms/:id', messSetup.updateRoom);
router.patch('/rooms/:id/deactivate', messSetup.setRoomActive(false));
router.patch('/rooms/:id/activate', messSetup.setRoomActive(true));

// seats
router.post('/rooms/:id/seats', messSetup.createSeat);
router.patch('/seats/:id/rent', messSetup.updateSeatRent);
router.patch('/seats/:id/deactivate', messSetup.setSeatActive(false));
router.patch('/seats/:id/activate', messSetup.setSeatActive(true));
router.get('/rooms-seats', messSetup.roomsAndSeats);

// vacancy posts
router.post('/posts', vacancyPost.createPost);
router.get('/posts', vacancyPost.myPosts);
router.patch('/posts/:id/close', vacancyPost.closePost);

// students who are interested in the mess
router.get('/interests', interest.forManager);

// dashboard
router.get('/dashboard', dashboard.dashboard);

// members (keep '/members/ex' above '/members/:id')
router.get('/members', members.list);
router.get('/members/ex', members.exMembers);
router.get('/members/:id', members.details);
router.post('/members', members.add);
router.patch('/members/:id/leave', members.leave);
router.get('/students/search', members.searchStudents);

// rent and payments
router.get('/dues', members.dues);
router.get('/dues/overdue', members.overdue);
router.get('/payments', members.payments);
router.post('/payments', members.recordPayment);

// visit requests
router.get('/visits', visit.forManager);
router.patch('/visits/:id/confirm', visit.answer('confirm'));
router.patch('/visits/:id/reject', visit.answer('reject'));
router.patch('/visits/:id/complete', visit.answer('complete'));

// reviews
router.get('/reviews', review.forManager);
router.patch('/reviews/:id/reply', review.reply);

module.exports = router;
