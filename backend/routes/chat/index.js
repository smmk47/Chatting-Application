const express = require('express');
const roomManagement = require('./roomManagement');
const roomQueries = require('./roomQueries');
const messageManagement = require('./messageManagement');
const utility = require('./utility');

const router = express.Router();

// Mount all route modules
router.use('/', roomManagement);
router.use('/', roomQueries);
router.use('/', messageManagement);
router.use('/', utility);

module.exports = router;
