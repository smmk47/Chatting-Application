const admin = require('../config/firebase');
const { User, RoomMember } = require('../models');

class NotificationService {
    constructor() {
        try {
            console.log('📱 [NOTIFICATION_SERVICE] Initializing Firebase Cloud Messaging service...');
            this.messaging = admin.messaging();
            console.log('✅ [NOTIFICATION_SERVICE] Firebase Cloud Messaging service initialized successfully');
            console.log('📱 [NOTIFICATION_SERVICE] Service ready to send push notifications');
        } catch (error) {
            console.error('❌ [NOTIFICATION_SERVICE] Failed to initialize Firebase Cloud Messaging service:', error);
            throw error;
        }
    }

    /**
     * Check if a user is currently active in a specific room
     * @param {string} userId - Firebase UID of the user
     * @param {number} roomId - Room ID
     * @returns {boolean} - True if user is active in the room
     */
    isUserActiveInRoom(userId, roomId) {
        try {
            // Get socket manager instance from global scope
            const socketManager = global.socketManager;
            
            if (!socketManager) {
                console.log('📱 [ACTIVE_CHECK] Socket manager not available, assuming user is not active');
                return false;
            }
            
            // Check if user is in the room using socket manager
            const userRooms = socketManager.userRooms.get(userId) || new Set();
            const isInRoom = userRooms.has(roomId);
            
            console.log(`📱 [ACTIVE_CHECK] User ${userId} active in room ${roomId}: ${isInRoom}`);
            
            return isInRoom;
            
        } catch (error) {
            console.error('❌ [ACTIVE_CHECK] Error checking if user is active in room:', error);
            return false;
        }
    }

    /**
     * Get list of active users in a room
     * @param {number} roomId - Room ID
     * @returns {Array<string>} - Array of active user IDs
     */
    getActiveUsersInRoom(roomId) {
        try {
            const socketManager = global.socketManager;
            
            if (!socketManager) {
                console.log('📱 [ACTIVE_USERS] Socket manager not available, returning empty list');
                return [];
            }
            
            // Try to use the socket manager's method first (more reliable)
            if (typeof socketManager.getActiveUsersInRoom === 'function') {
                console.log('📱 [ACTIVE_USERS] Using socket manager\'s getActiveUsersInRoom method');
                return socketManager.getActiveUsersInRoom(roomId);
            }
            
            // Fallback to direct access if method doesn't exist
            console.log('📱 [ACTIVE_USERS] Using fallback method - direct access to roomUsers Map');
            
            // Ensure roomId is a number for consistent key matching
            const numericRoomId = parseInt(roomId);
            console.log(`📱 [ACTIVE_USERS] Checking room ${roomId} (converted to ${numericRoomId})`);
            
            // Debug: Log all available room keys
            const availableRoomKeys = Array.from(socketManager.roomUsers.keys());
            console.log(`📱 [ACTIVE_USERS] Available room keys in socket manager:`, availableRoomKeys);
            console.log(`📱 [ACTIVE_USERS] Room keys types:`, availableRoomKeys.map(key => `${key} (${typeof key})`));
            
            // Try both string and number versions of the room ID
            let roomUsers = socketManager.roomUsers.get(numericRoomId);
            if (!roomUsers) {
                roomUsers = socketManager.roomUsers.get(roomId.toString());
                if (roomUsers) {
                    console.log(`📱 [ACTIVE_USERS] Found room users using string key: ${roomId.toString()}`);
                }
            } else {
                console.log(`📱 [ACTIVE_USERS] Found room users using numeric key: ${numericRoomId}`);
            }
            
            if (!roomUsers) {
                console.log(`📱 [ACTIVE_USERS] No room users found for room ${roomId} (tried both ${numericRoomId} and "${roomId}")`);
                console.log(`📱 [ACTIVE_USERS] This could mean: no users are currently active in this room`);
                return [];
            }
            
            const activeUsers = Array.from(roomUsers);
            
            console.log(`📱 [ACTIVE_USERS] Active users in room ${roomId}: ${activeUsers.length}`);
            console.log(`📱 [ACTIVE_USERS] Active user IDs:`, activeUsers);
            
            // Debug: Show the actual Set object
            console.log(`📱 [ACTIVE_USERS] Room users Set object:`, roomUsers);
            console.log(`📱 [ACTIVE_USERS] Room users Set size:`, roomUsers.size);
            
            return activeUsers;
            
        } catch (error) {
            console.error('❌ [ACTIVE_USERS] Error getting active users in room:', error);
            console.error('📱 [ACTIVE_USERS] Error details:', {
                message: error.message,
                stack: error.stack?.split('\n')[0]
            });
            return [];
        }
    }

    /**
     * Check if socket manager is available and properly initialized
     * @returns {Object} - Status information about socket manager
     */
    checkSocketManagerStatus() {
        try {
            const socketManager = global.socketManager;
            
            if (!socketManager) {
                return {
                    available: false,
                    reason: 'global.socketManager is not set',
                    message: 'Socket manager not available globally'
                };
            }
            
            // Check if required properties exist
            const hasUserSockets = !!socketManager.userSockets;
            const hasRoomUsers = !!socketManager.roomUsers;
            const hasUserRooms = !!socketManager.userRooms;
            
            // Check if they are Maps
            const isUserSocketsMap = hasUserSockets && socketManager.userSockets instanceof Map;
            const isRoomUsersMap = hasRoomUsers && socketManager.roomUsers instanceof Map;
            const isUserRoomsMap = hasUserRooms && socketManager.userRooms instanceof Map;
            
            // Get some stats
            const totalConnectedUsers = hasUserSockets ? socketManager.userSockets.size : 0;
            const totalTrackedRooms = hasRoomUsers ? socketManager.roomUsers.size : 0;
            
            const status = {
                available: true,
                hasUserSockets: hasUserSockets,
                hasRoomUsers: hasRoomUsers,
                hasUserRooms: hasUserRooms,
                isUserSocketsMap: isUserSocketsMap,
                isRoomUsersMap: isRoomUsersMap,
                isUserRoomsMap: isUserRoomsMap,
                totalConnectedUsers: totalConnectedUsers,
                totalTrackedRooms: totalTrackedRooms,
                message: 'Socket manager is available and properly initialized'
            };
            
            // Check for potential issues
            if (!hasUserSockets || !hasRoomUsers || !hasUserRooms) {
                status.message = 'Socket manager is missing required properties';
                status.available = false;
            } else if (!isUserSocketsMap || !isRoomUsersMap || !isUserRoomsMap) {
                status.message = 'Socket manager properties are not Maps';
                status.available = false;
            }
            
            return status;
            
        } catch (error) {
            return {
                available: false,
                reason: 'Error checking socket manager',
                error: error.message,
                message: 'Failed to check socket manager status'
            };
        }
    }

    /**
     * Send push notification to a single user
     * @param {string} userId - Firebase UID of the user
     * @param {Object} notification - Notification payload
     * @param {Object} data - Additional data payload
     * @returns {Promise<boolean>}
     */
    async sendToUser(userId, notification, data = {}) {
        try {
            console.log(`📱 [SEND_TO_USER] Starting notification send to user ${userId}`);
            console.log(`📱 [SEND_TO_USER] Notification:`, JSON.stringify(notification, null, 2));
            console.log(`📱 [SEND_TO_USER] Data:`, JSON.stringify(data, null, 2));
            
            // Get user's FCM token
            console.log(`📱 [SEND_TO_USER] Querying user ${userId} for FCM token...`);
            const user = await User.findOne({
                where: { firebase_uid: userId },
                attributes: ['fcm_token', 'push_notifications_enabled']
            });

            if (!user) {
                console.log(`⚠️ [SEND_TO_USER] User ${userId} not found in database`);
                return false;
            }

            if (!user.push_notifications_enabled) {
                console.log(`⚠️ [SEND_TO_USER] User ${userId} has notifications disabled`);
                return false;
            }

            if (!user.fcm_token) {
                console.log(`⚠️ [SEND_TO_USER] User ${userId} has no FCM token`);
                return false;
            }

            console.log(`📱 [SEND_TO_USER] User ${userId} is eligible for notifications`);
            console.log(`📱 [SEND_TO_USER] FCM token length: ${user.fcm_token.length}`);
            console.log(`📱 [SEND_TO_USER] Token preview: ${user.fcm_token.substring(0, 20)}...`);

            const message = {
                token: user.fcm_token,
                notification: {
                    title: notification.title,
                    body: notification.body,
                    image: notification.image || null
                },
                data: {
                    ...data,
                    click_action: 'FLUTTER_NOTIFICATION_CLICK' // For mobile apps
                },
                android: {
                    priority: 'high',
                    notification: {
                        sound: 'default',
                        priority: 'high',
                        channel_id: 'chat_messages'
                    }
                },
                apns: {
                    payload: {
                        aps: {
                            sound: 'default',
                            badge: 1
                        }
                    }
                },
                webpush: {
                    headers: {
                        Urgency: 'high'
                    },
                    notification: {
                        requireInteraction: true,
                        icon: '/favicon.ico'
                    }
                }
            };

            console.log(`📱 [SEND_TO_USER] Prepared FCM message for user ${userId}:`, {
                token_length: message.token.length,
                notification_title: message.notification.title,
                notification_body: message.notification.body,
                data_keys: Object.keys(message.data),
                platform_configs: {
                    android: !!message.android,
                    apns: !!message.apns,
                    webpush: !!message.webpush
                }
            });

            console.log(`📱 [SEND_TO_USER] Sending FCM message to user ${userId}...`);
            const response = await this.messaging.send(message);
            
            console.log(`✅ [SEND_TO_USER] Push notification sent successfully to user ${userId}`);
            console.log(`📱 [SEND_TO_USER] FCM response:`, {
                messageId: response,
                timestamp: new Date().toISOString()
            });
            
            return true;

        } catch (error) {
            console.error(`❌ [SEND_TO_USER] Failed to send push notification to user ${userId}:`, error);
            console.error(`📱 [SEND_TO_USER] Error details:`, {
                code: error.code,
                message: error.message,
                stack: error.stack?.split('\n')[0]
            });
            
            // If token is invalid, remove it from user
            if (error.code === 'messaging/invalid-registration-token' || 
                error.code === 'messaging/registration-token-not-registered') {
                console.log(`📱 [SEND_TO_USER] Invalid token detected for user ${userId}, removing...`);
                await this.removeInvalidToken(userId);
            }
            
            return false;
        }
    }

    /**
     * Send push notification to all members of a room (excluding sender and active users)
     * @param {number} roomId - Room ID
     * @param {string} senderId - Firebase UID of the message sender
     * @param {Object} notification - Notification payload
     * @param {Object} data - Additional data payload
     * @returns {Promise<number>} - Number of notifications sent
     */
    async sendToRoomMembers(roomId, senderId, notification, data = {}) {
        try {
            console.log(`📱 [NOTIFICATION] Starting room notification process for room ${roomId}`);
            console.log(`📱 [NOTIFICATION] Sender ID: ${senderId}`);
            console.log(`📱 [NOTIFICATION] Notification payload:`, JSON.stringify(notification, null, 2));
            console.log(`📱 [NOTIFICATION] Data payload:`, JSON.stringify(data, null, 2));
            
            // Check socket manager status first
            console.log(`📱 [NOTIFICATION] Checking socket manager status...`);
            const socketStatus = this.checkSocketManagerStatus();
            console.log(`📱 [NOTIFICATION] Socket manager status:`, socketStatus);
            
            if (!socketStatus.available) {
                console.warn(`⚠️ [NOTIFICATION] Socket manager not available: ${socketStatus.message}`);
                console.warn(`⚠️ [NOTIFICATION] Active user filtering will be disabled`);
            }
            
            // Get all room members except sender
            console.log(`📱 [NOTIFICATION] Querying room members for room ${roomId}...`);
            const members = await RoomMember.findAll({
                where: { 
                    room_id: roomId,
                    firebase_uid: { [require('sequelize').Op.ne]: senderId }
                },
                include: [{
                    model: User,
                    as: 'User',
                    attributes: ['firebase_uid', 'fcm_token', 'push_notifications_enabled']
                }]
            });

            console.log(`📱 [NOTIFICATION] Found ${members.length} room members (excluding sender)`);
            
            // Get active users in the room to exclude them from notifications
            const activeUsers = this.getActiveUsersInRoom(roomId);
            console.log(`📱 [NOTIFICATION] Active users in room ${roomId}: ${activeUsers.length}`);
            console.log(`📱 [NOTIFICATION] Active user IDs:`, activeUsers);
            
            // Debug: Log all members before filtering
            console.log(`📱 [NOTIFICATION] All members before filtering:`, members.map(m => ({
                firebase_uid: m.User?.firebase_uid,
                username: m.User?.username,
                has_fcm_token: !!m.User?.fcm_token,
                notifications_enabled: m.User?.push_notifications_enabled
            })));
            
            // Filter out active users from members list
            let inactiveMembers;
            if (socketStatus.available && activeUsers.length > 0) {
                inactiveMembers = members.filter(member => {
                    const user = member.User;
                    const isActive = activeUsers.includes(user.firebase_uid);
                    
                    console.log(`📱 [NOTIFICATION] Checking member ${user.firebase_uid} (${user.username || 'Unknown'}):`, {
                        firebase_uid: user.firebase_uid,
                        isActive: isActive,
                        inActiveUsersList: activeUsers.includes(user.firebase_uid),
                        activeUsersList: activeUsers
                    });
                    
                    if (isActive) {
                        console.log(`📱 [NOTIFICATION] Skipping active user ${user.firebase_uid} (${user.username || 'Unknown'})`);
                    }
                    return !isActive;
                });
                
                console.log(`📱 [NOTIFICATION] After filtering active users: ${inactiveMembers.length} members eligible for notifications`);
            } else {
                console.log(`📱 [NOTIFICATION] Socket manager not available or no active users detected, skipping active user filtering`);
                inactiveMembers = members;
            }

            if (inactiveMembers.length === 0) {
                console.log(`⚠️ [NOTIFICATION] No inactive members found for room ${roomId} (all members are active or sender)`);
                return 0;
            }

            // Log member details for debugging
            inactiveMembers.forEach((member, index) => {
                const user = member.User;
                console.log(`📱 [NOTIFICATION] Member ${index + 1}:`, {
                    firebase_uid: user?.firebase_uid,
                    has_fcm_token: !!user?.fcm_token,
                    token_length: user?.fcm_token ? user.fcm_token.length : 0,
                    notifications_enabled: user?.push_notifications_enabled,
                    eligible_for_notification: !!(user?.push_notifications_enabled && user?.fcm_token)
                });
            });

            let successCount = 0;
            let failedCount = 0;
            let skippedCount = 0;
            
            console.log(`📱 [NOTIFICATION] Starting individual notification sends...`);
            
            const promises = inactiveMembers.map(async (member, index) => {
                const user = member.User;
                
                if (!user) {
                    console.log(`⚠️ [NOTIFICATION] Member ${index + 1}: No user data found`);
                    skippedCount++;
                    return;
                }
                
                if (!user.push_notifications_enabled) {
                    console.log(`⚠️ [NOTIFICATION] Member ${index + 1} (${user.firebase_uid}): Notifications disabled`);
                    skippedCount++;
                    return;
                }
                
                if (!user.fcm_token) {
                    console.log(`⚠️ [NOTIFICATION] Member ${index + 1} (${user.firebase_uid}): No FCM token`);
                    skippedCount++;
                    return;
                }
                
                console.log(`📱 [NOTIFICATION] Sending to member ${index + 1} (${user.firebase_uid})...`);
                console.log(`📱 [NOTIFICATION] Token preview: ${user.fcm_token.substring(0, 20)}...`);
                
                try {
                    const success = await this.sendToUser(user.firebase_uid, notification, data);
                    if (success) {
                        successCount++;
                        console.log(`✅ [NOTIFICATION] Successfully sent to member ${index + 1} (${user.firebase_uid})`);
                    } else {
                        failedCount++;
                        console.log(`❌ [NOTIFICATION] Failed to send to member ${index + 1} (${user.firebase_uid})`);
                    }
                } catch (error) {
                    failedCount++;
                    console.error(`❌ [NOTIFICATION] Error sending to member ${index + 1} (${user.firebase_uid}):`, error.message);
                }
            });

            await Promise.all(promises);
            
            console.log(`📱 [NOTIFICATION] Room notification process completed for room ${roomId}`);
            console.log(`📱 [NOTIFICATION] Summary: ${successCount} successful, ${failedCount} failed, ${skippedCount} skipped`);
            console.log(`📱 [NOTIFICATION] Total members processed: ${inactiveMembers.length} (excluding ${activeUsers.length} active users)`);
            
            return successCount;

        } catch (error) {
            console.error(`❌ [NOTIFICATION] Failed to send push notifications to room ${roomId}:`, error);
            return 0;
        }
    }

    /**
     * Send push notification to multiple users
     * @param {Array<string>} userIds - Array of Firebase UIDs
     * @param {Object} notification - Notification payload
     * @param {Object} data - Additional data payload
     * @returns {Promise<number>} - Number of notifications sent
     */
    async sendToMultipleUsers(userIds, notification, data = {}) {
        try {
            console.log(`📱 [BULK_NOTIFICATION] Starting bulk notification to ${userIds.length} users`);
            console.log(`📱 [BULK_NOTIFICATION] User IDs:`, userIds);
            console.log(`📱 [BULK_NOTIFICATION] Notification:`, JSON.stringify(notification, null, 2));
            console.log(`📱 [BULK_NOTIFICATION] Data:`, JSON.stringify(data, null, 2));
            
            if (!Array.isArray(userIds) || userIds.length === 0) {
                console.log('⚠️ [BULK_NOTIFICATION] No user IDs provided for bulk notification');
                return 0;
            }

            // Get users' FCM tokens
            console.log(`📱 [BULK_NOTIFICATION] Querying users for FCM tokens...`);
            const users = await User.findAll({
                where: { 
                    firebase_uid: { [require('sequelize').Op.in]: userIds },
                    push_notifications_enabled: true
                },
                attributes: ['firebase_uid', 'fcm_token']
            });

            console.log(`📱 [BULK_NOTIFICATION] Found ${users.length} users with notifications enabled`);

            if (users.length === 0) {
                console.log('⚠️ [BULK_NOTIFICATION] No eligible users found for bulk notification');
                return 0;
            }

            // Filter out users without FCM tokens
            const validUsers = users.filter(user => user.fcm_token);
            const usersWithoutTokens = users.filter(user => !user.fcm_token);
            
            console.log(`📱 [BULK_NOTIFICATION] Users with valid FCM tokens: ${validUsers.length}`);
            console.log(`📱 [BULK_NOTIFICATION] Users without FCM tokens: ${usersWithoutTokens.length}`);
            
            if (usersWithoutTokens.length > 0) {
                console.log(`📱 [BULK_NOTIFICATION] Users without tokens:`, usersWithoutTokens.map(u => u.firebase_uid));
            }
            
            if (validUsers.length === 0) {
                console.log('⚠️ [BULK_NOTIFICATION] No users with valid FCM tokens found');
                return 0;
            }

            // Send to each user individually (more reliable than multicast)
            console.log(`📱 [BULK_NOTIFICATION] Starting individual sends to ${validUsers.length} users...`);
            let successCount = 0;
            let failedCount = 0;
            
            const promises = validUsers.map(async (user, index) => {
                console.log(`📱 [BULK_NOTIFICATION] Sending to user ${index + 1}/${validUsers.length}: ${user.firebase_uid}`);
                try {
                    const success = await this.sendToUser(user.firebase_uid, notification, data);
                    if (success) {
                        successCount++;
                        console.log(`✅ [BULK_NOTIFICATION] Successfully sent to user ${index + 1}/${validUsers.length}: ${user.firebase_uid}`);
                    } else {
                        failedCount++;
                        console.log(`❌ [BULK_NOTIFICATION] Failed to send to user ${index + 1}/${validUsers.length}: ${user.firebase_uid}`);
                    }
                } catch (error) {
                    failedCount++;
                    console.error(`❌ [BULK_NOTIFICATION] Error sending to user ${index + 1}/${validUsers.length}: ${user.firebase_uid}:`, error.message);
                }
            });

            await Promise.all(promises);
            
            console.log(`📱 [BULK_NOTIFICATION] Bulk notification process completed`);
            console.log(`📱 [BULK_NOTIFICATION] Summary: ${successCount} successful, ${failedCount} failed`);
            console.log(`📱 [BULK_NOTIFICATION] Total users processed: ${validUsers.length}`);
            
            return successCount;

        } catch (error) {
            console.error('❌ [BULK_NOTIFICATION] Failed to send bulk push notifications:', error);
            return 0;
        }
    }

    /**
     * Send multicast notification (more efficient for large groups)
     * @param {Array<string>} tokens - Array of FCM tokens
     * @param {Object} notification - Notification payload
     * @param {Object} data - Additional data payload
     * @returns {Promise<Object>} - Multicast response
     */
    async sendMulticast(tokens, notification, data = {}) {
        try {
            console.log(`📱 [MULTICAST] Starting multicast notification to ${tokens.length} tokens`);
            console.log(`📱 [MULTICAST] Notification:`, JSON.stringify(notification, null, 2));
            console.log(`📱 [MULTICAST] Data:`, JSON.stringify(data, null, 2));
            console.log(`📱 [MULTICAST] Token count: ${tokens.length}`);
            
            if (!Array.isArray(tokens) || tokens.length === 0) {
                throw new Error('No FCM tokens provided for multicast');
            }

            // Log token previews for debugging
            tokens.forEach((token, index) => {
                console.log(`📱 [MULTICAST] Token ${index + 1}: ${token.substring(0, 20)}... (length: ${token.length})`);
            });

            const message = {
                notification: {
                    title: notification.title,
                    body: notification.body,
                    image: notification.image || null
                },
                data: data,
                android: {
                    priority: 'high',
                    notification: {
                        sound: 'default',
                        priority: 'high',
                        channel_id: 'chat_messages'
                    }
                },
                apns: {
                    payload: {
                        aps: {
                            sound: 'default',
                            badge: 1
                        }
                    }
                },
                webpush: {
                    headers: {
                        Urgency: 'high'
                    },
                    notification: {
                        requireInteraction: true,
                        icon: '/favicon.ico'
                    }
                }
            };

            console.log(`📱 [MULTICAST] Prepared multicast message:`, {
                notification_title: message.notification.title,
                notification_body: message.notification.body,
                data_keys: Object.keys(message.data),
                platform_configs: {
                    android: !!message.android,
                    apns: !!message.apns,
                    webpush: !!message.webpush
                }
            });

            console.log(`📱 [MULTICAST] Sending multicast message...`);
            const response = await this.messaging.sendMulticast({
                tokens: tokens,
                ...message
            });

            console.log(`📱 [MULTICAST] Multicast response received:`, {
                successCount: response.successCount,
                failureCount: response.failureCount,
                totalTokens: tokens.length,
                timestamp: new Date().toISOString()
            });
            
            console.log(`✅ [MULTICAST] Multicast notification sent: ${response.successCount}/${tokens.length} successful`);
            
            // Handle failed tokens
            if (response.failureCount > 0) {
                console.log(`📱 [MULTICAST] Processing ${response.failureCount} failed tokens...`);
                
                const failedTokens = response.responses
                    .map((resp, idx) => resp.success ? null : tokens[idx])
                    .filter(token => token !== null);
                
                console.log(`⚠️ [MULTICAST] Failed tokens:`, failedTokens);
                
                // Log failure reasons
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        console.log(`📱 [MULTICAST] Token ${idx + 1} failed:`, {
                            error: resp.error?.message || 'Unknown error',
                            code: resp.error?.code || 'No code'
                        });
                    }
                });
                
                // Remove invalid tokens from users
                console.log(`📱 [MULTICAST] Removing ${failedTokens.length} invalid tokens...`);
                await this.removeInvalidTokens(failedTokens);
            } else {
                console.log(`📱 [MULTICAST] All tokens processed successfully`);
            }

            return response;

        } catch (error) {
            console.error('❌ [MULTICAST] Failed to send multicast notification:', error);
            console.error(`📱 [MULTICAST] Error details:`, {
                message: error.message,
                code: error.code,
                stack: error.stack?.split('\n')[0]
            });
            throw error;
        }
    }

    /**
     * Remove invalid FCM token from user
     * @param {string} userId - Firebase UID
     */
    async removeInvalidToken(userId) {
        try {
            console.log(`🗑️ [REMOVE_TOKEN] Removing invalid FCM token for user ${userId}...`);
            
            const result = await User.update(
                { 
                    fcm_token: null,
                    fcm_token_updated_at: new Date()
                },
                { where: { firebase_uid: userId } }
            );
            
            if (result[0] > 0) {
                console.log(`✅ [REMOVE_TOKEN] Successfully removed invalid FCM token for user ${userId}`);
            } else {
                console.log(`⚠️ [REMOVE_TOKEN] No rows updated for user ${userId} (user may not exist)`);
            }
        } catch (error) {
            console.error(`❌ [REMOVE_TOKEN] Failed to remove invalid token for user ${userId}:`, error);
        }
    }

    /**
     * Remove invalid FCM tokens from users
     * @param {Array<string>} tokens - Array of invalid FCM tokens
     */
    async removeInvalidTokens(tokens) {
        try {
            console.log(`🗑️ [REMOVE_TOKENS] Starting bulk removal of ${tokens.length} invalid FCM tokens...`);
            
            if (!Array.isArray(tokens) || tokens.length === 0) {
                console.log(`⚠️ [REMOVE_TOKENS] No tokens provided for removal`);
                return;
            }

            // Log token previews for debugging
            tokens.forEach((token, index) => {
                console.log(`🗑️ [REMOVE_TOKENS] Token ${index + 1}: ${token.substring(0, 20)}... (length: ${token.length})`);
            });

            const result = await User.update(
                { 
                    fcm_token: null,
                    fcm_token_updated_at: new Date()
                },
                { 
                    where: { 
                        fcm_token: { [require('sequelize').Op.in]: tokens }
                    }
                }
            );
            
            console.log(`✅ [REMOVE_TOKENS] Successfully removed ${result[0]} invalid FCM tokens from database`);
            console.log(`📱 [REMOVE_TOKENS] Tokens processed: ${tokens.length}, Rows updated: ${result[0]}`);
            
        } catch (error) {
            console.error('❌ [REMOVE_TOKENS] Failed to remove invalid tokens:', error);
            console.error(`📱 [REMOVE_TOKENS] Error details:`, {
                message: error.message,
                code: error.code,
                stack: error.stack?.split('\n')[0]
            });
        }
    }

    /**
     * Update user's FCM token with conflict handling
     * @param {string} userId - Firebase UID
     * @param {string} fcmToken - New FCM token
     * @returns {Promise<boolean>}
     */
    async updateFCMToken(userId, fcmToken) {
        try {
            console.log(`📱 [UPDATE_TOKEN] Updating FCM token for user ${userId}...`);
            console.log(`📱 [UPDATE_TOKEN] New token length: ${fcmToken.length}`);
            console.log(`📱 [UPDATE_TOKEN] Token preview: ${fcmToken.substring(0, 20)}...`);
            
            // First, check if this token is already used by another user
            const existingUser = await User.findOne({
                where: { 
                    fcm_token: fcmToken,
                    firebase_uid: { [require('sequelize').Op.ne]: userId }
                },
                attributes: ['firebase_uid', 'username', 'fcm_token_updated_at']
            });
            
            if (existingUser) {
                console.log(`⚠️ [UPDATE_TOKEN] FCM token conflict detected!`);
                console.log(`📱 [UPDATE_TOKEN] Token already in use by user ${existingUser.firebase_uid} (${existingUser.username})`);
                console.log(`📱 [UPDATE_TOKEN] Previous token updated: ${existingUser.fcm_token_updated_at}`);
                console.log(`📱 [UPDATE_TOKEN] Removing token from previous user...`);
                
                // Remove token from the previous user
                await User.update(
                    { 
                        fcm_token: null,
                        fcm_token_updated_at: new Date()
                    },
                    { where: { firebase_uid: existingUser.firebase_uid } }
                );
                
                console.log(`✅ [UPDATE_TOKEN] Removed FCM token from user ${existingUser.firebase_uid}`);
                console.log(`📱 [UPDATE_TOKEN] This ensures each user has a unique FCM token`);
            }
            
            // Now update the current user's token
            const result = await User.update(
                { 
                    fcm_token: fcmToken,
                    fcm_token_updated_at: new Date()
                },
                { where: { firebase_uid: userId } }
            );
            
            if (result[0] > 0) {
                console.log(`✅ [UPDATE_TOKEN] Successfully updated FCM token for user ${userId}`);
                console.log(`📱 [UPDATE_TOKEN] Rows affected: ${result[0]}`);
                return true;
            } else {
                console.log(`⚠️ [UPDATE_TOKEN] No rows updated for user ${userId} (user may not exist)`);
                return false;
            }
        } catch (error) {
            console.error(`❌ [UPDATE_TOKEN] Failed to update FCM token for user ${userId}:`, error);
            console.error(`📱 [UPDATE_TOKEN] Error details:`, {
                message: error.message,
                code: error.code,
                stack: error.stack?.split('\n')[0]
            });
            return false;
        }
    }

    /**
     * Update user's notification preferences
     * @param {string} userId - Firebase UID
     * @param {boolean} enabled - Whether push notifications are enabled
     * @returns {Promise<boolean>}
     */
    async updateNotificationPreferences(userId, enabled) {
        try {
            await User.update(
                { push_notifications_enabled: enabled },
                { where: { firebase_uid: userId } }
            );
            console.log(`✅ Updated notification preferences for user ${userId}: ${enabled}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to update notification preferences for user ${userId}:`, error);
            return false;
        }
    }

    /**
     * Get user's notification status
     * @param {string} userId - Firebase UID
     * @returns {Promise<Object>}
     */
    async getNotificationStatus(userId) {
        try {
            const user = await User.findOne({
                where: { firebase_uid: userId },
                attributes: ['fcm_token', 'push_notifications_enabled', 'fcm_token_updated_at']
            });

            return {
                hasToken: !!user?.fcm_token,
                tokenLength: user?.fcm_token ? user.fcm_token.length : 0,
                enabled: user?.push_notifications_enabled || false,
                lastUpdated: user?.fcm_token_updated_at
            };
        } catch (error) {
            console.error(`❌ Failed to get notification status for user ${userId}:`, error);
            return null;
        }
    }
    
    /**
     * Validate FCM token uniqueness across all users
     * @returns {Promise<Object>}
     */
    async validateTokenUniqueness() {
        try {
            console.log('📱 [VALIDATION] Checking FCM token uniqueness across all users...');
            
            // Find all users with FCM tokens
            const usersWithTokens = await User.findAll({
                where: { 
                    fcm_token: { [require('sequelize').Op.ne]: null }
                },
                attributes: ['firebase_uid', 'username', 'fcm_token', 'fcm_token_updated_at']
            });
            
            console.log(`📱 [VALIDATION] Found ${usersWithTokens.length} users with FCM tokens`);
            
            // Group by token to find duplicates
            const tokenGroups = {};
            usersWithTokens.forEach(user => {
                const token = user.fcm_token;
                if (!tokenGroups[token]) {
                    tokenGroups[token] = [];
                }
                tokenGroups[token].push({
                    firebase_uid: user.firebase_uid,
                    username: user.username,
                    updated_at: user.fcm_token_updated_at
                });
            });
            
            // Find duplicate tokens
            const duplicates = Object.entries(tokenGroups)
                .filter(([token, users]) => users.length > 1)
                .map(([token, users]) => ({
                    token: token.substring(0, 20) + '...',
                    users: users,
                    count: users.length
                }));
            
            if (duplicates.length > 0) {
                console.warn(`⚠️ [VALIDATION] Found ${duplicates.length} duplicate FCM tokens:`);
                duplicates.forEach(dup => {
                    console.warn(`📱 [VALIDATION] Token ${dup.token} used by ${dup.count} users:`, dup.users);
                });
            } else {
                console.log('✅ [VALIDATION] All FCM tokens are unique');
            }
            
            return {
                totalUsers: usersWithTokens.length,
                uniqueTokens: Object.keys(tokenGroups).length,
                duplicates: duplicates,
                isValid: duplicates.length === 0
            };
            
        } catch (error) {
            console.error('❌ [VALIDATION] Failed to validate token uniqueness:', error);
            return null;
        }
    }

    /**
     * Get detailed notification eligibility information for a room
     * @param {number} roomId - Room ID
     * @param {string} senderId - Firebase UID of the message sender
     * @returns {Promise<Object>} - Detailed eligibility information
     */
    async getNotificationEligibility(roomId, senderId) {
        try {
            console.log(`📱 [ELIGIBILITY] Checking notification eligibility for room ${roomId}`);
            
            // Get all room members
            const allMembers = await RoomMember.findAll({
                where: { room_id: roomId },
                include: [{
                    model: User,
                    as: 'User',
                    attributes: ['firebase_uid', 'username', 'display_name', 'fcm_token', 'push_notifications_enabled']
                }]
            });
            
            // Get active users in the room
            const activeUsers = this.getActiveUsersInRoom(roomId);
            
            const eligibility = {
                roomId: roomId,
                senderId: senderId,
                totalMembers: allMembers.length,
                activeUsers: activeUsers.length,
                eligibleForNotifications: 0,
                excludedReasons: {
                    sender: 0,
                    active: 0,
                    noFcmToken: 0,
                    notificationsDisabled: 0
                },
                memberDetails: []
            };
            
            allMembers.forEach(member => {
                const user = member.User;
                const isSender = user.firebase_uid === senderId;
                const isActive = activeUsers.includes(user.firebase_uid);
                const hasFcmToken = !!user.fcm_token;
                const notificationsEnabled = user.push_notifications_enabled;
                
                let reason = null;
                if (isSender) {
                    reason = 'sender';
                    eligibility.excludedReasons.sender++;
                } else if (isActive) {
                    reason = 'active';
                    eligibility.excludedReasons.active++;
                } else if (!hasFcmToken) {
                    reason = 'noFcmToken';
                    eligibility.excludedReasons.noFcmToken++;
                } else if (!notificationsEnabled) {
                    reason = 'notificationsDisabled';
                    eligibility.excludedReasons.notificationsDisabled++;
                } else {
                    eligibility.eligibleForNotifications++;
                }
                
                eligibility.memberDetails.push({
                    firebase_uid: user.firebase_uid,
                    username: user.username || 'Unknown',
                    display_name: user.display_name,
                    isSender: isSender,
                    isActive: isActive,
                    hasFcmToken: hasFcmToken,
                    notificationsEnabled: notificationsEnabled,
                    eligible: !reason,
                    exclusionReason: reason
                });
            });
            
            console.log(`📱 [ELIGIBILITY] Eligibility summary for room ${roomId}:`, {
                totalMembers: eligibility.totalMembers,
                activeUsers: eligibility.activeUsers,
                eligibleForNotifications: eligibility.eligibleForNotifications,
                excludedReasons: eligibility.excludedReasons
            });
            
            return eligibility;
            
        } catch (error) {
            console.error(`❌ [ELIGIBILITY] Error getting notification eligibility for room ${roomId}:`, error);
            return null;
        }
    }
}

module.exports = new NotificationService();
