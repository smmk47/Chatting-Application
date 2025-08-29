const express = require('express');
const auth = require('./auth');
const profile = require('./profile');
const notifications = require('./notifications');

const router = express.Router();

// Mount all route modules
router.use('/', auth);
router.use('/', profile);
router.use('/notifications', notifications);

module.exports = router;
