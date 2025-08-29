const express = require('express');
const { firebaseAuth } = require('../../middleware/firebaseAuth');
const notificationService = require('../../services/notificationService');

const router = express.Router();

// Update user's FCM token
router.post('/fcm-token', firebaseAuth, async (req, res) => {
    try {
        const { fcm_token } = req.body;
        const userId = req.user.firebase_uid;
        
        if (!fcm_token) {
            return res.status(400).json({
                message: 'FCM token is required'
            });
        }
        
        const success = await notificationService.updateFCMToken(userId, fcm_token);
        
        if (success) {
            res.json({
                message: 'FCM token updated successfully',
                success: true
            });
        } else {
            res.status(500).json({
                message: 'Failed to update FCM token',
                success: false
            });
        }
        
    } catch (error) {
        console.error('❌ Update FCM token error:', error);
        res.status(500).json({
            message: 'Failed to update FCM token',
            error: error.message
        });
    }
});

// Update user's notification preferences
router.post('/preferences', firebaseAuth, async (req, res) => {
    try {
        const { enabled } = req.body;
        const userId = req.user.firebase_uid;
        
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({
                message: 'Notification preference must be a boolean value'
            });
        }
        
        const success = await notificationService.updateNotificationPreferences(userId, enabled);
        
        if (success) {
            res.json({
                message: `Push notifications ${enabled ? 'enabled' : 'disabled'} successfully`,
                success: true,
                enabled: enabled
            });
        } else {
            res.status(500).json({
                message: 'Failed to update notification preferences',
                success: false
            });
        }
        
    } catch (error) {
        console.error('❌ Update notification preferences error:', error);
        res.status(500).json({
            message: 'Failed to update notification preferences',
            error: error.message
        });
    }
});

// Get user's notification status
router.get('/status', firebaseAuth, async (req, res) => {
    try {
        const userId = req.user.firebase_uid;
        
        const status = await notificationService.getNotificationStatus(userId);
        
        if (status) {
            res.json({
                message: 'Notification status retrieved successfully',
                status: status
            });
        } else {
            res.status(500).json({
                message: 'Failed to retrieve notification status'
            });
        }
        
    } catch (error) {
        console.error('❌ Get notification status error:', error);
        res.status(500).json({
            message: 'Failed to retrieve notification status',
            error: error.message
        });
    }
});

// Test push notification (for development/testing)
router.post('/test', firebaseAuth, async (req, res) => {
    try {
        const userId = req.user.firebase_uid;
        const { title = 'Test Notification', body = 'This is a test push notification' } = req.body;
        
        const notification = {
            title: title,
            body: body
        };
        
        const data = {
            type: 'test_notification',
            timestamp: new Date().toISOString()
        };
        
        const success = await notificationService.sendToUser(userId, notification, data);
        
        if (success) {
            res.json({
                message: 'Test notification sent successfully',
                success: true
            });
        } else {
            res.status(400).json({
                message: 'Failed to send test notification. Check if user has valid FCM token and notifications are enabled.',
                success: false
            });
        }
        
    } catch (error) {
        console.error('❌ Test notification error:', error);
        res.status(500).json({
            message: 'Failed to send test notification',
            error: error.message
        });
    }
});

// Check FCM token uniqueness endpoint
router.get('/token-uniqueness', firebaseAuth, async (req, res) => {
    try {
        const result = await notificationService.validateTokenUniqueness();
        
        if (result) {
            res.json({
                message: 'Token uniqueness validation completed',
                result: result
            });
        } else {
            res.status(500).json({ message: 'Failed to validate token uniqueness' });
        }
        
    } catch (error) {
        console.error('❌ Token uniqueness validation error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Check notification eligibility for a specific room
router.get('/eligibility/:roomId', firebaseAuth, async (req, res) => {
    try {
        const { roomId } = req.params;
        const userId = req.user.firebase_uid;
        
        if (!roomId || isNaN(parseInt(roomId))) {
            return res.status(400).json({
                message: 'Valid room ID is required'
            });
        }
        
        const eligibility = await notificationService.getNotificationEligibility(parseInt(roomId), userId);
        
        if (eligibility) {
            res.json({
                message: 'Notification eligibility retrieved successfully',
                eligibility: eligibility
            });
        } else {
            res.status(500).json({
                message: 'Failed to retrieve notification eligibility'
            });
        }
        
    } catch (error) {
        console.error('❌ Get notification eligibility error:', error);
        res.status(500).json({
            message: 'Failed to retrieve notification eligibility',
            error: error.message
        });
    }
});

// Get active users in a specific room
router.get('/active-users/:roomId', firebaseAuth, async (req, res) => {
    try {
        const { roomId } = req.params;
        
        if (!roomId || isNaN(parseInt(roomId))) {
            return res.status(400).json({
                message: 'Valid room ID is required'
            });
        }
        
        const activeUsers = notificationService.getActiveUsersInRoom(parseInt(roomId));
        
        res.json({
            message: 'Active users retrieved successfully',
            roomId: parseInt(roomId),
            activeUsers: activeUsers,
            count: activeUsers.length
        });
        
    } catch (error) {
        console.error('❌ Get active users error:', error);
        res.status(500).json({
            message: 'Failed to retrieve active users',
            error: error.message
        });
    }
});

// Check socket manager status
router.get('/socket-status', firebaseAuth, async (req, res) => {
    try {
        const status = notificationService.checkSocketManagerStatus();
        
        res.json({
            message: 'Socket manager status retrieved successfully',
            status: status
        });
        
    } catch (error) {
        console.error('❌ Get socket status error:', error);
        res.status(500).json({
            message: 'Failed to retrieve socket status',
            error: error.message
        });
    }
});

module.exports = router;
