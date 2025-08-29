const express = require('express');
const { ChatRoom, RoomMember, ChatMessage, User } = require('../../models');
const { firebaseAuth } = require('../../middleware/firebaseAuth');
const upload = require('../../middleware/upload');
const cloudinary = require('../../config/cloudinary');
const fs = require('fs');
const uploadConfig = require('../../config/upload');

const router = express.Router();

/**
 * Get chat messages for a specific room
 * GET /rooms/:roomId/messages
 */
router.get('/rooms/:roomId/messages', firebaseAuth, async (req, res) => {
    try {
        const { roomId } = req.params;
        const { limit = 50, offset = 0 } = req.query;
        const userId = req.user.firebase_uid;
        
        // Verify user is a member of the room
        const memberCheck = await RoomMember.findOne({
            where: { room_id: roomId, firebase_uid: userId }
        });
        
        if (!memberCheck) {
            return res.status(403).json({
                message: 'You are not a member of this chat room'
            });
        }
        
        // Retrieve messages with user information
        const messages = await ChatMessage.findAll({
            where: { room_id: roomId },
            include: [
                {
                    model: User,
                    as: 'User',
                    attributes: ['id', 'username', 'display_name', 'avatar_url']
                }
            ],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
        // Format messages and reverse to show oldest first
        const formattedMessages = messages.reverse().map(msg => ({
            id: msg.id,
            message: msg.message,
            message_type: msg.message_type,
            created_at: msg.created_at,
            firebase_uid: msg.firebase_uid,
            // File metadata fields
            file_url: msg.file_url,
            file_name: msg.file_name,
            file_type: msg.file_type,
            file_size: msg.file_size,
            file_public_id: msg.file_public_id,
            user: {
                id: msg.User.id,
                username: msg.User.username,
                display_name: msg.User.display_name,
                avatar_url: msg.User.avatar_url
            }
        }));
        
        res.json({
            message: 'Chat messages retrieved successfully',
            messages: formattedMessages
        });
        
    } catch (error) {
        console.error('❌ Get messages error:', error);
        res.status(500).json({
            message: 'Failed to retrieve chat messages',
            error: error.message
        });
    }
});

/**
 * Send a text message to a chat room
 * POST /rooms/:roomId/messages
 */
router.post('/rooms/:roomId/messages', firebaseAuth, async (req, res) => {
    try {
        const { roomId } = req.params;
        const { message, message_type = 'text' } = req.body;
        const userId = req.user.firebase_uid;
        
        // Validate message content
        if (!message || message.trim().length === 0) {
            return res.status(400).json({
                message: 'Message cannot be empty'
            });
        }
        
        if (message.length > 1000) {
            return res.status(400).json({
                message: 'Message too long (max 1000 characters)'
            });
        }
        
        // Verify user is a member of the room
        const memberCheck = await RoomMember.findOne({
            where: { room_id: roomId, firebase_uid: userId }
        });
        
        if (!memberCheck) {
            return res.status(403).json({
                message: 'You are not a member of this chat room'
            });
        }
        
        // Save message to database
        const savedMessage = await ChatMessage.create({
            room_id: roomId,
            firebase_uid: userId,
            message: message.trim(),
            message_type: message_type
        });
        
        // Get user info for response
        const user = await User.findOne({
            where: { firebase_uid: userId },
            attributes: ['id', 'username', 'display_name', 'avatar_url']
        });
        
        const messageWithUser = {
            ...savedMessage.toJSON(),
            user: user.toJSON()
        };
        
        // Send push notifications to room members (excluding sender)
        await sendPushNotifications(roomId, userId, message, message_type, user);
        
        // Broadcast text message to room via socket (for real-time updates)
        await broadcastMessageToRoom(req, roomId, messageWithUser);
        
        res.status(201).json({
            message: 'Message sent successfully',
            chatMessage: messageWithUser
        });
        
    } catch (error) {
        console.error('❌ Send message error:', error);
        res.status(500).json({
            message: 'Failed to send message',
            error: error.message
        });
    }
});

/**
 * Upload file and send as message
 * POST /rooms/:roomId/upload
 */
router.post('/rooms/:roomId/upload', firebaseAuth, upload.single('file'), async (req, res) => {
    try {
        const { roomId } = req.params;
        const { message = '', message_type = 'file' } = req.body;
        const userId = req.user.firebase_uid;
        
        // Check if file was uploaded
        if (!req.file) {
            return res.status(400).json({
                message: 'No file uploaded'
            });
        }
        
        // Verify user is a member of the room
        const memberCheck = await RoomMember.findOne({
            where: { room_id: roomId, firebase_uid: userId }
        });
        
        if (!memberCheck) {
            return res.status(403).json({
                message: 'You are not a member of this chat room'
            });
        }
        
        // Validate file size (5MB limit)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (req.file.size > maxSize) {
            // Remove uploaded file
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                message: 'File size too large (max 5MB)'
            });
        }
        
        // Validate file type
        const allowedTypes = uploadConfig.allowedTypes;
        if (!allowedTypes.includes(req.file.mimetype)) {
            // Remove uploaded file
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                message: 'File type not allowed'
            });
        }
        
        // Upload file to Cloudinary
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
            resource_type: 'auto',
            folder: 'chat-files',
            public_id: `chat-${roomId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        });
        
        // Remove local file after upload
        fs.unlinkSync(req.file.path);
        
        // Save message with file metadata
        const savedMessage = await ChatMessage.create({
            room_id: roomId,
            firebase_uid: userId,
            message: message || `Shared file: ${req.file.originalname}`,
            message_type: message_type,
            file_url: uploadResult.secure_url,
            file_name: req.file.originalname,
            file_type: req.file.mimetype,
            file_size: req.file.size,
            file_public_id: uploadResult.public_id
        });
        
        // Get user info for response
        const user = await User.findOne({
            where: { firebase_uid: userId },
            attributes: ['id', 'username', 'display_name', 'avatar_url']
        });
        
        const messageWithUser = {
            ...savedMessage.toJSON(),
            user: user.toJSON()
        };
        
        // Send push notifications to room members (excluding sender)
        await sendPushNotifications(roomId, userId, message, message_type, user, req.file);
        
        // Broadcast file message to room via socket (for real-time updates)
        await broadcastMessageToRoom(req, roomId, messageWithUser);
        
        res.status(201).json({
            message: 'File uploaded and message sent successfully',
            chatMessage: messageWithUser
        });
        
    } catch (error) {
        console.error('❌ File upload error:', error);
        
        // Clean up uploaded file if it exists
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (cleanupError) {
                console.error('❌ File cleanup error:', cleanupError);
            }
        }
        
        res.status(500).json({
            message: 'Failed to upload file',
            error: error.message
        });
    }
});

/**
 * Send push notifications to room members (excluding sender)
 */
async function sendPushNotifications(roomId, userId, message, messageType, user, file = null) {
    try {
        const notificationService = require('../../services/notificationService');
        const { ChatRoom } = require('../../models');
        
        // Get room info
        const room = await ChatRoom.findByPk(roomId);
        if (!room) return;
        
        // Prepare notification content
        let notificationTitle, notificationBody;
        if (file) {
            const fileType = file.mimetype.startsWith('image/') ? 'image' : 'file';
            notificationTitle = `${user.display_name || user.username} shared a ${fileType}`;
            notificationBody = message || `Shared ${fileType}: ${file.originalname}`;
        } else {
            notificationTitle = `${user.display_name || user.username} sent a message`;
            notificationBody = message.length > 100 ? message.substring(0, 100) + '...' : message;
        }
        
        const notification = {
            title: notificationTitle,
            body: notificationBody,
            image: file && file.mimetype.startsWith('image/') ? file.secure_url : user.avatar_url || null
        };
        
        const data = {
            type: file ? 'file_message' : 'chat_message',
            room_id: roomId.toString(),
            room_name: room.name,
            sender_id: userId,
            sender_name: user.display_name || user.username,
            message: message || `Shared file: ${file?.originalname}`,
            message_type: messageType,
            file_url: file ? file.secure_url : null,
            file_name: file ? file.originalname : null,
            file_type: file ? file.mimetype : null,
            timestamp: new Date().toISOString()
        };
        
        // Send push notifications asynchronously
        notificationService.sendToRoomMembers(roomId, userId, notification, data)
            .then(count => {
                if (count > 0) {
                    console.log(`📱 Sent ${count} push notifications for room ${roomId}`);
                }
            })
            .catch(error => {
                console.error(`❌ Push notification error for room ${roomId}:`, error);
            });
            
    } catch (error) {
        console.error(`❌ Failed to send push notifications for room ${roomId}:`, error);
    }
}

/**
 * Broadcast message to room via socket for real-time updates
 */
async function broadcastMessageToRoom(req, roomId, messageWithUser) {
    try {
        const socketManager = req.app.get('socketManager');
        
        if (socketManager) {
            socketManager.io.to(`room_${roomId}`).emit('message_received', {
                roomId,
                message: messageWithUser,
                timestamp: new Date()
            });
            console.log(`📡 Message broadcasted to room ${roomId}`);
        } else {
            console.warn(`⚠️ Socket manager not available for room ${roomId}`);
        }
    } catch (error) {
        console.error(`❌ Error broadcasting message to room ${roomId}:`, error);
    }
}

module.exports = router;
