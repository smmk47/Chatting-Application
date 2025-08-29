const { Server } = require('socket.io');
const SocketAuthMiddleware = require('./middleware/socketAuth');
const { RoomMember, User, ChatMessage, ChatRoom } = require('./models');

/**
 * Socket.io Manager for Real-time Chat
 * Handles all WebSocket connections, room management, and real-time messaging
 */
class SocketManager {
    constructor(server) {
        this.io = new Server(server, {
            cors: {
                origin: process.env.CORS_ORIGIN || "http://localhost:3000",
                methods: ["GET", "POST"],
                credentials: true
            }
        });
        
        // User and room tracking maps
        this.userSockets = new Map(); // Map firebase_uid to socket
        this.roomUsers = new Map();   // Map room_id to Set of firebase_uid
        this.userRooms = new Map();   // Map firebase_uid to Set of room_id
        this.typingUsers = new Map(); // Map room_id to Set of typing users
        
        // Initialize Firebase auth middleware
        this.authMiddleware = new SocketAuthMiddleware();
        
        this.initializeSocket();
    }
    
    /**
     * Initialize socket connection handling and authentication
     */
    initializeSocket() {
        this.io.use(async (socket, next) => {
            try {
                await this.authMiddleware.authenticate(socket, next);
            } catch (error) {
                next(new Error('Authentication failed'));
            }
        });
        
        this.io.on('connection', (socket) => {
            console.log(`🔌 User connected: ${socket.user.username} (${socket.user.firebase_uid})`);
            this.handleConnection(socket);
        });
    }
    
    /**
     * Handle new socket connection and set up event listeners
     */
    handleConnection(socket) {
        const { firebase_uid } = socket.user;
        
        // Store user socket mapping
        this.userSockets.set(firebase_uid, socket);
        
        // Update user status to online
        this.broadcastUserStatus(firebase_uid, 'online');
        
        // Set up event listeners
        socket.on('disconnect', () => {
            console.log(`🔌 User disconnected: ${firebase_uid}`);
            this.handleDisconnection(firebase_uid);
        });
        
        socket.on('join_room', async (data) => {
            await this.handleJoinRoom(socket, data);
        });
        
        socket.on('leave_room', async (data) => {
            await this.handleLeaveRoom(socket, data);
        });
        
        socket.on('send_message', async (data) => {
            await this.handleSendMessage(socket, data);
        });
        
        socket.on('typing_start', (data) => {
            this.handleTypingStart(socket, data);
        });
        
        socket.on('typing_stop', (data) => {
            this.handleTypingStop(socket, data);
        });
        
        socket.on('user_status', (data) => {
            this.handleUserStatus(socket, data);
        });
    }
    
    /**
     * Handle socket disconnection and cleanup
     */
    async handleDisconnection(firebase_uid) {
        // Get user info for broadcast before cleanup
        const userInfo = await this.getUserInfo(firebase_uid);
        
        // Remove user from all rooms and notify other users
        const userRooms = this.userRooms.get(firebase_uid) || new Set();
        for (const roomId of userRooms) {
            // Broadcast user left to room before removing from tracking
            this.io.to(`room_${roomId}`).emit('user_left', {
                roomId,
                user: userInfo,
                timestamp: new Date()
            });
            
            // Remove user from room tracking
            this.removeUserFromRoom(firebase_uid, roomId);
        }
        this.userRooms.delete(firebase_uid);
        
        // Remove user socket mapping
        this.userSockets.delete(firebase_uid);
        
        // Update user status to offline
        this.broadcastUserStatus(firebase_uid, 'offline');
        
        console.log(`🔌 User ${firebase_uid} disconnected and cleaned up`);
    }
    
    /**
     * Handle forced disconnection (when session is invalidated)
     */
    async handleForcedDisconnection(firebase_uid, reason = 'Session invalidated') {
        console.log(`🚫 Forcing disconnection for user ${firebase_uid}: ${reason}`);
        
        const socket = this.userSockets.get(firebase_uid);
        if (socket) {
            // Notify user about forced disconnection
            socket.emit('forced_disconnect', {
                reason: reason,
                message: 'Your session has been invalidated. Please login again.',
                timestamp: new Date()
            });
            
            // Force disconnect the socket
            socket.disconnect(true);
        }
        
        // Clean up user data
        await this.handleDisconnection(firebase_uid);
    }
    
    /**
     * Handle user joining a chat room
     */
    async handleJoinRoom(socket, data) {
        try {
            const { roomId } = data;
            const { firebase_uid } = socket.user;
            
            console.log(`👥 User ${firebase_uid} joining room ${roomId}`);
            
            // Verify user is member of the room
            const isMember = await this.verifyRoomMembership(firebase_uid, roomId);
            if (!isMember) {
                socket.emit('error', { message: 'You are not a member of this room' });
                return;
            }
            
            // Join the socket room
            socket.join(`room_${roomId}`);
            
            // Update room tracking
            this.addUserToRoom(firebase_uid, roomId);
            
            // Get user info for broadcast
            const userInfo = await this.getUserInfo(firebase_uid);
            
            // Broadcast user joined to room
            this.io.to(`room_${roomId}`).emit('user_joined', {
                roomId,
                user: userInfo,
                timestamp: new Date()
            });
            
            // Send confirmation to user
            socket.emit('room_joined', {
                roomId,
                message: 'Successfully joined room'
            });
            
            console.log(`✅ User ${firebase_uid} joined room ${roomId}`);
            
        } catch (error) {
            console.error('❌ Join room error:', error);
            socket.emit('error', { message: 'Failed to join room' });
        }
    }
    
    /**
     * Handle user leaving a chat room
     */
    async handleLeaveRoom(socket, data) {
        try {
            const { roomId } = data;
            const { firebase_uid } = socket.user;
            
            console.log(`👋 User ${firebase_uid} leaving room ${roomId}`);
            
            // Get user info for broadcast BEFORE leaving
            const userInfo = await this.getUserInfo(firebase_uid);
            
            // Broadcast user left to room BEFORE the user actually leaves
            this.io.to(`room_${roomId}`).emit('user_left', {
                roomId,
                user: userInfo,
                timestamp: new Date()
            });
            
            // Leave the socket room
            socket.leave(`room_${roomId}`);
            
            // Update room tracking
            this.removeUserFromRoom(firebase_uid, roomId);
            
            // Send confirmation to user
            socket.emit('room_left', {
                roomId,
                message: 'Successfully left room'
            });
            
            console.log(`✅ User ${firebase_uid} left room ${roomId}`);
            
        } catch (error) {
            console.error('❌ Leave room error:', error);
            socket.emit('error', { message: 'Failed to leave room' });
        }
    }
    
    /**
     * Handle sending a message to a chat room
     */
    async handleSendMessage(socket, data) {
        try {
            const { roomId, message, messageType = 'text', fileData } = data;
            const { firebase_uid } = socket.user;
            
            console.log(`💬 User ${firebase_uid} sending message to room ${roomId}`);
            
            // Verify user is member of the room
            const isMember = await this.verifyRoomMembership(firebase_uid, roomId);
            if (!isMember) {
                socket.emit('error', { message: 'You are not a member of this room' });
                return;
            }
            
            // Save message to database
            let savedMessage;
            if (messageType === 'file' && fileData) {
                savedMessage = await this.saveFileMessageToDatabase(roomId, firebase_uid, message, messageType, fileData);
            } else {
                savedMessage = await this.saveMessageToDatabase(roomId, firebase_uid, message, messageType);
            }
            
            // Get user info for the message
            const userInfo = await this.getUserInfo(firebase_uid);
            
            // Get room info for push notifications
            const roomInfo = await this.getRoomInfo(roomId);
            
            // Send push notifications to room members (excluding sender)
            if (roomInfo) {
                await this.sendPushNotifications(roomId, firebase_uid, message, messageType, userInfo, roomInfo);
            }
            
            // Prepare message object for broadcast
            const messageObject = {
                id: savedMessage.id,
                room_id: roomId,
                firebase_uid,
                message,
                message_type: messageType,
                created_at: savedMessage.created_at,
                user: userInfo
            };
            
            // Add file metadata if it's a file message
            if (messageType === 'file' && savedMessage.file_url) {
                messageObject.file_url = savedMessage.file_url;
                messageObject.file_name = savedMessage.file_name;
                messageObject.file_type = savedMessage.file_type;
                messageObject.file_size = savedMessage.file_size;
                messageObject.file_public_id = savedMessage.file_public_id;
            }
            
            // Broadcast message to room
            this.io.to(`room_${roomId}`).emit('message_received', {
                roomId,
                message: messageObject,
                timestamp: new Date()
            });
            
            // Send confirmation to sender
            socket.emit('message_sent', {
                roomId,
                message: messageObject,
                timestamp: new Date()
            });
            
            console.log(`✅ Message sent to room ${roomId}`);
            
        } catch (error) {
            console.error('❌ Send message error:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    }
    
    /**
     * Send push notifications to room members (excluding sender)
     */
    async sendPushNotifications(roomId, firebase_uid, message, messageType, userInfo, roomInfo) {
        try {
            const notificationService = require('./services/notificationService');
            const notification = {
                title: `${userInfo.display_name || userInfo.username} sent a message`,
                body: message.length > 100 ? message.substring(0, 100) + '...' : message,
                image: userInfo.avatar_url || null
            };
            
            const data = {
                type: 'chat_message',
                roomId: roomId.toString(),
                roomName: roomInfo.name,
                senderId: firebase_uid,
                senderName: userInfo.display_name || userInfo.username,
                message: message,
                messageType: messageType,
                timestamp: new Date().toISOString()
            };
            
            // Send push notifications asynchronously
            notificationService.sendToRoomMembers(roomId, firebase_uid, notification, data)
                .then(count => {
                    if (count > 0) {
                        console.log(`📱 Sent ${count} push notifications for room ${roomId}`);
                    }
                })
                .catch(error => {
                    console.error('❌ Push notification error:', error);
                });
        } catch (error) {
            console.error('❌ Failed to send push notifications:', error);
        }
    }
    
    /**
     * Handle typing start indicator
     */
    handleTypingStart(socket, data) {
        const { roomId } = data;
        const { firebase_uid } = socket.user;
        
        // Add user to typing set for the room
        if (!this.typingUsers.has(roomId)) {
            this.typingUsers.set(roomId, new Set());
        }
        this.typingUsers.get(roomId).add(firebase_uid);
        
        // Broadcast typing indicator to room (excluding sender)
        socket.to(`room_${roomId}`).emit('typing_indicator', {
            roomId,
            firebase_uid,
            isTyping: true,
            timestamp: new Date()
        });
    }
    
    /**
     * Handle typing stop indicator
     */
    handleTypingStop(socket, data) {
        const { roomId } = data;
        const { firebase_uid } = socket.user;
        
        // Remove user from typing set for the room
        if (this.typingUsers.has(roomId)) {
            this.typingUsers.get(roomId).delete(firebase_uid);
        }
        
        // Broadcast typing indicator to room (excluding sender)
        socket.to(`room_${roomId}`).emit('typing_indicator', {
            roomId,
            firebase_uid,
            isTyping: false,
            timestamp: new Date()
        });
    }
    
    /**
     * Handle user status updates
     */
    handleUserStatus(socket, data) {
        const { status } = data;
        const { firebase_uid } = socket.user;
        
        // Broadcast user status to all connected users
        this.broadcastUserStatus(firebase_uid, status);
    }
    
    /**
     * Broadcast user status to all connected users
     */
    broadcastUserStatus(firebase_uid, status) {
        this.io.emit('user_status', {
            firebase_uid,
            status,
            timestamp: new Date()
        });
    }
    
    /**
     * Add user to room tracking
     */
    addUserToRoom(firebase_uid, roomId) {
        // Add to room users
        if (!this.roomUsers.has(roomId)) {
            this.roomUsers.set(roomId, new Set());
        }
        this.roomUsers.get(roomId).add(firebase_uid);
        
        // Add to user rooms
        if (!this.userRooms.has(firebase_uid)) {
            this.userRooms.set(firebase_uid, new Set());
        }
        this.userRooms.get(firebase_uid).add(roomId);
    }
    
    /**
     * Remove user from room tracking
     */
    removeUserFromRoom(firebase_uid, roomId) {
        // Remove from room users
        if (this.roomUsers.has(roomId)) {
            this.roomUsers.get(roomId).delete(firebase_uid);
        }
        
        // Remove from user rooms
        if (this.userRooms.has(firebase_uid)) {
            this.userRooms.get(firebase_uid).delete(roomId);
        }
    }
    
    /**
     * Verify user is member of the room
     */
    async verifyRoomMembership(firebase_uid, roomId) {
        try {
            const member = await RoomMember.findOne({
                where: { firebase_uid: firebase_uid, room_id: roomId }
            });
            return !!member;
        } catch (error) {
            console.error('❌ Verify membership error:', error);
            return false;
        }
    }
    
    /**
     * Get user information from database
     */
    async getUserInfo(firebase_uid) {
        try {
            const user = await User.findOne({
                where: { firebase_uid: firebase_uid },
                attributes: ['id', 'firebase_uid', 'username', 'display_name', 'avatar_url']
            });
            return user ? user.toJSON() : null;
        } catch (error) {
            console.error('❌ Get user info error:', error);
            return null;
        }
    }
    
    /**
     * Save text message to database
     */
    async saveMessageToDatabase(roomId, firebase_uid, message, messageType) {
        try {
            const chatMessage = await ChatMessage.create({
                room_id: roomId,
                firebase_uid: firebase_uid,
                message: message,
                message_type: messageType
            });
            return chatMessage.toJSON();
        } catch (error) {
            console.error('❌ Save message error:', error);
            throw error;
        }
    }

    /**
     * Save file message to database
     */
    async saveFileMessageToDatabase(roomId, firebase_uid, message, messageType, fileData) {
        try {
            const chatMessage = await ChatMessage.create({
                room_id: roomId,
                firebase_uid: firebase_uid,
                message: message,
                message_type: messageType,
                file_url: fileData.url,
                file_name: fileData.name,
                file_type: fileData.type,
                file_size: fileData.size,
                file_public_id: fileData.public_id
            });
            
            return chatMessage.toJSON();
        } catch (error) {
            console.error('❌ Save file message error:', error);
            throw error;
        }
    }
    
    /**
     * Get room statistics
     */
    getRoomStats(roomId) {
        const roomUsers = this.roomUsers.get(roomId) || new Set();
        return {
            roomId,
            memberCount: roomUsers.size,
            members: Array.from(roomUsers),
            typingUsers: Array.from(this.typingUsers.get(roomId) || new Set())
        };
    }
    
    /**
     * Get all connected users
     */
    getConnectedUsers() {
        return Array.from(this.userSockets.keys());
    }
    
    /**
     * Get user's current rooms
     */
    getUserRooms(firebase_uid) {
        return Array.from(this.userRooms.get(firebase_uid) || new Set());
    }

    /**
     * Get room information from database
     */
    async getRoomInfo(roomId) {
        try {
            const room = await ChatRoom.findOne({
                where: { id: roomId },
                attributes: ['id', 'name', 'description', 'is_private']
            });
            return room ? room.toJSON() : null;
        } catch (error) {
            console.error('❌ Get room info error:', error);
            return null;
        }
    }

    /**
     * Get active users in a room (for notification service)
     */
    getActiveUsersInRoom(roomId) {
        try {
            const numericRoomId = parseInt(roomId);
            let roomUsers = this.roomUsers.get(numericRoomId);
            
            if (!roomUsers) {
                roomUsers = this.roomUsers.get(roomId.toString());
            }
            
            if (!roomUsers) {
                return [];
            }
            
            return Array.from(roomUsers);
            
        } catch (error) {
            console.error('❌ Error getting active users in room:', error);
            return [];
        }
    }
}

module.exports = SocketManager;
