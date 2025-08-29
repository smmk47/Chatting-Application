const express = require('express');
const bcrypt = require('bcrypt');
const { ChatRoom, RoomMember, User } = require('../../models');
const { firebaseAuth } = require('../../middleware/firebaseAuth');

const router = express.Router();

// Create a new chat room
router.post('/rooms', firebaseAuth, async (req, res) => {
    try {
        console.log('🚀 POST /rooms - Creating new chat room');
        
        const { name, description, is_private, password, max_members } = req.body;
        const userId = req.user.firebase_uid;
        console.log(req.body);
        // Validation
        if (!name || name.trim().length === 0) {
            return res.status(400).json({
                message: 'Room name is required'
            });
        }
        
        if (name.length > 100) {
            return res.status(400).json({
                message: 'Room name must be less than 100 characters'
            });
        }
        
        if (max_members && (max_members < 2 || max_members > 1000)) {
            return res.status(400).json({
                message: 'Max members must be between 2 and 1000'
            });
        }
        
        let passwordHash = null;
        if (is_private && password) {
            if (password.length < 4) {
                return res.status(400).json({
                    message: 'Password must be at least 4 characters long'
                });
            }
            passwordHash = await bcrypt.hash(password, 10);
        }
        
        // Create the chat room
        const newRoom = await ChatRoom.create({
            name: name.trim(),
            description: description?.trim() || null,
            is_private: !!is_private,
            password_hash: passwordHash,
            created_by: userId,
            max_members: max_members || 100
        });
        
        // Add creator as owner and member
        await RoomMember.create({
            room_id: newRoom.id,
            firebase_uid: userId,
            is_owner: true,
        });
        
        // Remove password hash from response
        const { password_hash, ...roomWithoutPassword } = newRoom.toJSON();
        
        res.status(201).json({
            message: 'Chat room created successfully',
            room: roomWithoutPassword
        });
        
    } catch (error) {
        console.error('❌ Create room error:', error);
        res.status(500).json({
            message: 'Failed to create chat room',
            error: error.message
        });
    }
});

// Join a chat room
router.post('/rooms/:roomId/join', firebaseAuth, async (req, res) => {
    try {
        console.log(`🚪 POST /rooms/${req.params.roomId}/join - Joining chat room`);
        
        const { roomId } = req.params;
        const { password } = req.body;
        const userId = req.user.firebase_uid;
        
        // Check if room exists
        const room = await ChatRoom.findByPk(roomId);
        
        if (!room) {
            return res.status(404).json({
                message: 'Chat room not found'
            });
        }
        
        // Check if user is already a member
        const existingMember = await RoomMember.findOne({
            where: { room_id: roomId, firebase_uid: userId }
        });
        
        if (existingMember) {
            return res.status(409).json({
                message: 'You are already a member of this chat room'
            });
        }
        
        // Check if room is private and password is required
        if (room.is_private) {
            if (!password) {
                return res.status(400).json({
                    message: 'Password is required to join this private room'
                });
            }
            
            if (!room.password_hash) {
                return res.status(500).json({
                    message: 'Room configuration error'
                });
            }
            
            // Verify password
            const isPasswordValid = await bcrypt.compare(password, room.password_hash);
            if (!isPasswordValid) {
                return res.status(401).json({
                    message: 'Incorrect password'
                });
            }
        }
        
        // Check if room is full
        const memberCount = await RoomMember.count({
            where: { room_id: roomId }
        });
        
        if (memberCount >= room.max_members) {
            return res.status(400).json({
                message: 'Chat room is full'
            });
        }
        
        // Join the room
        await RoomMember.create({
            room_id: roomId,
            firebase_uid: userId
        });
        
        res.json({
            message: 'Successfully joined the chat room'
        });
        
    } catch (error) {
        console.error('❌ Join room error:', error);
        res.status(500).json({
            message: 'Failed to join chat room',
            error: error.message
        });
    }
});

// Leave a chat room
router.post('/rooms/:roomId/leave', firebaseAuth, async (req, res) => {
    try {
        console.log(`🚪 POST /rooms/${req.params.roomId}/leave - Leaving chat room`);
        
        const { roomId } = req.params;
        const userId = req.user.firebase_uid;
        
        // Check if user is a member
        const member = await RoomMember.findOne({
            where: { room_id: roomId, firebase_uid: userId }
        });
        
        if (!member) {
            return res.status(403).json({
                message: 'You are not a member of this chat room'
            });
        }
        
        // Check if user is the owner
        if (member.is_owner) {
            return res.status(400).json({
                message: 'Room owner cannot leave. Transfer ownership or delete the room instead.'
            });
        }
        
        // Leave the room
        await member.destroy();
        
        res.json({
            message: 'Successfully left the chat room'
        });
        
    } catch (error) {
        console.error('❌ Leave room error:', error);
        res.status(500).json({
            message: 'Failed to leave chat room',
            error: error.message
        });
    }
});

// Delete a chat room (owner only)
router.delete('/rooms/:roomId', firebaseAuth, async (req, res) => {
    try {
        console.log(`🗑️ DELETE /rooms/${req.params.roomId} - Deleting chat room`);
        
        const { roomId } = req.params;
        const userId = req.user.firebase_uid;
        
        // Check if user is the owner
        const ownerCheck = await RoomMember.findOne({
            where: { room_id: roomId, firebase_uid: userId, is_owner: true }
        });
        
        if (!ownerCheck) {
            return res.status(403).json({
                message: 'Only room owner can delete the room'
            });
        }
        
        // Delete the room (cascade will handle members and messages)
        await ChatRoom.destroy({
            where: { id: roomId }
        });
        
        res.json({
            message: 'Chat room deleted successfully'
        });
        
    } catch (error) {
        console.error('❌ Delete room error:', error);
        res.status(500).json({
            message: 'Failed to delete chat room',
            error: error.message
        });
    }
});

module.exports = router;
