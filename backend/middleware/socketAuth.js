const admin = require('firebase-admin');
const { User } = require('../models');
const redis = require('../config/redis');

// Socket.io authentication middleware using session tokens
class SocketAuthMiddleware {
    constructor() {
        // Ensure Firebase Admin is initialized
        if (!admin.apps.length) {
            throw new Error('Firebase Admin SDK not initialized');
        }
    }
    
    // Verify session token for socket connections (same as HTTP API)
    async verifySessionToken(token) {
        try {
            if (!token) {
                throw new Error('No session token provided');
            }
            
            // Find the session in Redis by token
            const sessionKey = await this.findSessionByToken(token);
            if (!sessionKey) {
                throw new Error('Invalid session token');
            }
            
            // Extract firebase_uid from session key
            const firebase_uid = sessionKey.replace('session:', '');
            
            // Get user from database
            const user = await this.getUserByFirebaseUid(firebase_uid);

            if (!user) {
                throw new Error('User not found in database');
            }
             
            return user;
            
        } catch (error) {
            console.error('❌ Socket session auth error:', error.message);
            throw error;
        }
    }
    
    // Find session key by token in Redis
    async findSessionByToken(token) {
        try {
            // Get all session keys
            const sessionKeys = await redis.keys('session:*');
            
            // Check each session to find the matching token
            for (const key of sessionKeys) {
                const sessionToken = await redis.get(key);
                if (sessionToken === token) {
                    return key;
                }
            }
            
            return null;
            
        } catch (error) {
            console.error('❌ Redis session lookup error:', error);
            throw error;
        }
    }
    
    // Get user from database by Firebase UID
    async getUserByFirebaseUid(firebase_uid) {
        try {
            const user = await User.findOne({
                where: { firebase_uid: firebase_uid },
                attributes: ['id', 'firebase_uid', 'username', 'email', 'display_name', 'avatar_url', 'bio']
            });
            
            return user ? user.toJSON() : null;
            
        } catch (error) {
            console.error('❌ Database query error:', error);
            throw error;
        }
    }
    
    // Middleware function for Socket.io
    async authenticate(socket, next) {
        try {
            // Extract token from handshake auth
            const token = socket.handshake.auth.token;
            
            if (!token) {
                return next(new Error('Session token required'));
            }
            
            // Verify the session token and get user
            const user = await this.verifySessionToken(token);
            
            // Attach user to socket for later use
            socket.user = user;
            
            console.log(`🔐 Socket authenticated: ${user.username} (${user.firebase_uid})`);
            
            next();
            
        } catch (error) {
            console.error('❌ Socket authentication failed:', error.message);
            next(new Error('Authentication failed: ' + error.message));
        }
    }
}

module.exports = SocketAuthMiddleware;
