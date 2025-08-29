const express = require('express');
const { ChatRoom, RoomMember, ChatMessage, User, sequelize } = require('../../models');
const { firebaseAuth } = require('../../middleware/firebaseAuth');
const { fn, col } = require('sequelize');

const router = express.Router();

// Get all chat rooms (both public and private)
router.get('/rooms', async (req, res) => {
    try {
        console.log('📋 GET /rooms - Fetching all chat rooms');
        
        const result = await ChatRoom.findAll({
            attributes: [
                'id', 'name', 'description', 'is_private', 'max_members',
                'created_at', 'updated_at'
            ],
            include: [
                {
                    model: User,
                    as: 'Creator',
                    attributes: ['username'],
                    required: false
                }
            ],
            order: [['created_at', 'DESC']]
        });
        
       // Single query approach
        const memberCounts = await RoomMember.findAll({
            attributes: [
                'room_id',
                [sequelize.fn('COUNT', sequelize.col('*')), 'member_count']
            ],
            where: { 
                room_id: result.map(room => room.id) 
            },
            group: ['room_id']
        });

        // Then map the results to rooms
        const roomsWithMemberCount = result.map(room => {
            const memberCount = memberCounts.find(mc => mc.room_id === room.id)?.dataValues.member_count || 0;
            return {
                ...room.toJSON(),
                created_by_username: room.Creator?.username || null,
                current_members: memberCount
            };
        });
        
        res.json({
            message: 'All chat rooms retrieved successfully',
            rooms: roomsWithMemberCount
        });
        
    } catch (error) {
        console.error('❌ Get all rooms error:', error);
        res.status(500).json({
            message: 'Failed to retrieve chat rooms',
            error: error.message
        });
    }
});

// Get all public chat rooms with member counts in one query
router.get('/rooms/public', async (req, res) => {
    try {
        console.log('📋 GET /rooms/public - Fetching public chat rooms');
        
        const result = await ChatRoom.findAll({
            where: { is_private: false },
            attributes: [
                'id', 'name', 'description', 'is_private', 'max_members',
                'created_at', 'updated_at',
                [sequelize.fn('COUNT', sequelize.col('RoomMembers.id')), 'current_members']
            ],
            include: [
                {
                    model: User,
                    as: 'Creator',
                    attributes: ['username'],
                    required: false
                },
                {
                    model: RoomMember,
                    as: 'RoomMembers',
                    attributes: [],
                    required: false
                }
            ],
            group: ['ChatRoom.id', 'Creator.id'],
            order: [['created_at', 'DESC']]
        });
        
        const roomsWithMemberCount = result.map(room => ({
            ...room.toJSON(),
            created_by_username: room.Creator?.username || null,
            current_members: parseInt(room.getDataValue('current_members') || 0)
        }));

        //console.log('🔍 Rooms with member count:', roomsWithMemberCount);

        res.json({
            message: 'Public chat rooms retrieved successfully',
            rooms: roomsWithMemberCount
        });
        
    } catch (error) {
        console.error('❌ Get public rooms error:', error);
        res.status(500).json({
            message: 'Failed to retrieve public chat rooms',
            error: error.message
        });
    }
});

// Get user's joined chat rooms
router.get('/rooms/joined', firebaseAuth, async (req, res) => {
    try {
        console.log('👥 GET /rooms/joined - Fetching user joined rooms');
        
        const userId = req.user.firebase_uid;
        
        const result = await RoomMember.findAll({
            where: { firebase_uid: userId },
            include: [
                {
                    model: ChatRoom,
                    as: 'ChatRoom',
                    attributes: ['id', 'name', 'description', 'is_private', 'max_members', 'created_at', 'updated_at'],
                    include: [
                        {
                            model: User,
                            as: 'Creator',
                            attributes: ['username'],
                            required: false
                        }
                    ]
                }
            ],
            order: [['joined_at', 'DESC']]
        });

        // Get all room IDs to fetch member counts in a single query
        const roomIds = result.map(member => member.ChatRoom.id);
        
        // Single query to get member counts for all rooms
        const memberCounts = await RoomMember.findAll({
            attributes: [
                'room_id',
                [sequelize.fn('COUNT', sequelize.col('id')), 'member_count']
            ],
            where: { room_id: roomIds },
            group: ['room_id'],
            raw: true
        });

        // Create a map for quick lookup
        const memberCountMap = memberCounts.reduce((acc, item) => {
            acc[item.room_id] = parseInt(item.member_count);
            return acc;
        }, {});

        // Transform results using the member count map
        const roomsWithMemberCount = result.map((member) => {
            return {
                ...member.ChatRoom.toJSON(),
                created_by_username: member.ChatRoom.Creator?.username || null,
                joined_at: member.joined_at,
                is_owner: member.is_owner,
                current_members: memberCountMap[member.ChatRoom.id] || 0
            };
        });

        res.json({
            message: 'Joined chat rooms retrieved successfully',
            rooms: roomsWithMemberCount
        });
        
    } catch (error) {
        console.error('❌ Get joined rooms error:', error);
        res.status(500).json({
            message: 'Failed to retrieve joined chat rooms',
            error: error.message
        });
    }
});

// Get chat room details by ID
router.get('/rooms/:roomId', firebaseAuth, async (req, res) => {
    try {
        console.log(`🔍 GET /rooms/${req.params.roomId} - Fetching room details`);
        
        const { roomId } = req.params;
        const userId = req.user.firebase_uid;
        
        // Check if user is a member of this room
        const memberCheck = await RoomMember.findOne({
            where: { room_id: roomId, firebase_uid: userId }
        });
        
        if (!memberCheck) {
            return res.status(403).json({
                message: 'You are not a member of this chat room'
            });
        }
        
        // Get room details
        const room = await ChatRoom.findOne({
            where: { id: roomId },
            include: [
                {
                    model: User,
                    as: 'Creator',
                    attributes: ['username'],
                    required: false
                }
            ]
        });
        
        if (!room) {
            return res.status(404).json({
                message: 'Chat room not found'
            });
        }
        
        // Get room members
        const members = await RoomMember.findAll({
            where: { room_id: roomId },
            include: [
                {
                    model: User,
                    as: 'User',
                    attributes: ['id', 'username', 'display_name', 'avatar_url'],
                    required: true
                }
            ],
            order: [['is_owner', 'DESC'], ['joined_at', 'ASC']]
        });
        
        // Format members data
        const formattedMembers = members.map(member => ({
            id: member.User.id,
            username: member.User.username,
            display_name: member.User.display_name,
            avatar_url: member.User.avatar_url,
            joined_at: member.joined_at,
            is_owner: member.is_owner,
        }));

        res.json({
            message: 'Chat room details retrieved successfully',
            room: {
                ...room.toJSON(),
                created_by_username: room.Creator?.username || null,
                joined_at: memberCheck.joined_at,
                is_owner: memberCheck.is_owner,
                members: formattedMembers
            }
        });
        
    } catch (error) {
        console.error('❌ Get room details error:', error);
        res.status(500).json({
            message: 'Failed to retrieve chat room details',
            error: error.message
        });
    }
});

module.exports = router;
