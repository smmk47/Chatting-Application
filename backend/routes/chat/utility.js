const express = require('express');
const { firebaseAuth } = require('../../middleware/firebaseAuth');

const router = express.Router();

/**
 * Test endpoint to manually broadcast a message (for debugging)
 * POST /test-broadcast/:roomId
 */
router.post('/test-broadcast/:roomId', firebaseAuth, async (req, res) => {
    try {
        const { roomId } = req.params;
        const { message } = req.body;
        
        // Try to get socket manager
        let socketManager = req.app.get('socketManager');
        if (!socketManager) {
            socketManager = global.socketManager;
        }
        
        if (socketManager) {
            const testMessage = {
                id: Date.now(),
                room_id: roomId,
                firebase_uid: req.user.firebase_uid,
                message: message || 'Test message',
                message_type: 'text',
                created_at: new Date(),
                user: {
                    username: req.user.username || 'TestUser',
                    display_name: req.user.display_name || 'Test User',
                    avatar_url: null
                }
            };
            
            socketManager.io.to(`room_${roomId}`).emit('message_received', {
                roomId: roomId,
                message: testMessage,
                timestamp: new Date()
            });
            
            res.json({ success: true, message: 'Test message broadcasted' });
        } else {
            res.status(500).json({ success: false, message: 'Socket manager not available' });
        }
        
    } catch (error) {
        console.error('❌ Test broadcast error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
