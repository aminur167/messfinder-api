// /api/reference  (public lists for forms and filters)
const router = require('express').Router();
const reference = require('../controllers/reference.controller');

router.get('/areas', reference.areas);
router.get('/universities', reference.universities);
router.get('/facilities', reference.facilities);

module.exports = router;
