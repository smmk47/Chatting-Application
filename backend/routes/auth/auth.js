const express = require('express');
const admin = require('../../config/firebase');
const redis = require('../../config/redis');
const { User } = require('../../models');
const { Op } = require('sequelize');
const { firebaseAuth } = require('../../middleware/firebaseAuth');

const router = express.Router();

// Firebase signup endpoint (creates user in both Firebase and PostgreSQL)
router.post('/signup', async (req, res) => {
    try {
        console.log('🚀 POST /signup called');
        console.log('📋 Request body:', req.body);
        
        const { username, email, password } = req.body;
        
        if (!username || !email || !password) {
            return res.status(400).json({
                message: 'Username, email, and password are required'
            });
        }
        
        // Check if user already exists in database
        const existingUser = await User.findOne({
            where: {
                [Op.or]: [
                    { username: username },
                    { email: email }
                ]
            }
        });

        if (existingUser) {
            return res.status(409).json({
                message: 'User already exists'
            });
        }

        // Step 1: Create user in Firebase
        console.log('🔥 Creating user in Firebase...');
        let firebaseUser;
        try {
            firebaseUser = await admin.auth().createUser({
                email: email,
                password: password,
                displayName: username
            });
            console.log('✅ Firebase user created:', firebaseUser.uid);
        } catch (firebaseError) {
            console.error('❌ Firebase user creation failed:', firebaseError);
            return res.status(500).json({
                message: 'Failed to create Firebase user',
                error: firebaseError.message
            });
        }

        // Step 2: Create user in PostgreSQL with password
        console.log('🗄️ Creating user in PostgreSQL...');
        const newUser = await User.create({
            firebase_uid: firebaseUser.uid,
            username: username,
            email: email,
            display_name: username,
            password: password
        });

        console.log('✅ PostgreSQL user created:', newUser.username);

        res.status(201).json({
            message: 'User created successfully in both Firebase and PostgreSQL',
            user: newUser.toJSON(),
            firebaseUid: firebaseUser.uid
        });

    } catch (error) {
        console.error('❌ Signup error:', error);
        res.status(500).json({
            message: 'Failed to create user',
            error: error.message
        });
    }
});

// Login endpoint - accepts email/password and handles Firebase authentication
router.post('/login', async (req, res) => {
    try {
        console.log('🔐 POST /login called');
        console.log('📋 Request body:', req.body);
        
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                message: 'Email and password are required'
            });
        }
        
        // First, check if user exists in our database
        const user = await User.findOne({
            where: {
                email: email,
                password: password
            }
        });

        if (!user) {
            return res.status(401).json({
                message: 'Invalid credentials or user not found in database or password is incorrect'
            });
        }
        console.log('🔍 Found user:', user.username);
        
        // Now authenticate with Firebase using email/password
        try {
            // Sign in with Firebase using email/password
            const firebaseUser = await admin.auth().getUserByEmail(email);
            
            // Verify the user exists in Firebase
            if (firebaseUser.uid !== user.firebase_uid) {
                console.error('❌ Firebase UID mismatch');
                return res.status(401).json({
                    message: 'Invalid credentials'
                });
            }
            
            console.log('✅ Firebase user verified:', firebaseUser.uid);
            
            // IMPORTANT: Invalidate any existing session before creating a new one
            let sessionConflict = false;
            try {
                const existingSessionKey = `session:${user.firebase_uid}`;
                const existingSession = await redis.get(existingSessionKey);
                
                if (existingSession) {
                    console.log('🔄 Invalidating existing session for user:', user.firebase_uid);
                    await redis.del(existingSessionKey);
                    console.log('✅ Existing session invalidated');
                    sessionConflict = true;
                }
            } catch (sessionError) {
                console.warn('⚠️ Failed to invalidate existing session:', sessionError.message);
                // Continue with login even if session invalidation fails
            }
            
            // Generate a custom session token for this user
            const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Store new session in Redis
            try {
                await redis.setEx(`session:${user.firebase_uid}`, 86400, sessionToken);
                console.log('✅ New session stored in Redis');
            } catch (redisError) {
                console.warn('⚠️ Failed to store session in Redis:', redisError.message);
            }
            
            // Remove sensitive data before sending response
            const { firebase_uid, ...userWithoutSensitiveData } = user.toJSON();

            res.json({
                message: 'Login successful',
                user: userWithoutSensitiveData,
                firebaseUid: user.firebase_uid,
                sessionToken: sessionToken,
                sessionConflict: sessionConflict
            });
            
        } catch (firebaseError) {
            console.error('❌ Firebase authentication failed:', firebaseError.message);
            return res.status(401).json({
                message: 'Invalid credentials'
            });
        }

    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({
            message: 'Login failed',
            error: error.message
        });
    }
});

// Logout endpoint - clears Redis session and FCM token
router.post('/logout', firebaseAuth, async (req, res) => {
    try {
        const firebaseUid = req.user.firebase_uid;
        
        // Clear FCM token from user's account
        try {
            await User.update(
                { 
                    fcm_token: null,
                    fcm_token_updated_at: new Date()
                },
                { where: { firebase_uid: firebaseUid } }
            );
            console.log(`📱 [LOGOUT] FCM token cleared for user ${firebaseUid}`);
        } catch (fcmError) {
            console.warn(`⚠️ [LOGOUT] Failed to clear FCM token for user ${firebaseUid}:`, fcmError.message);
        }
        
        // Remove session from Redis
        await redis.del(`session:${firebaseUid}`);
        console.log('✅ Session removed from Redis for user:', firebaseUid);
        
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('❌ Logout error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Verify Firebase token endpoint
router.post('/verify-token', async (req, res) => {
    try {
        console.log('🔍 POST /verify-token called');
        const { idToken } = req.body;
        
        if (!idToken) {
            return res.status(400).json({ message: 'ID token is required' });
        }
        
        // Verify the token
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        
        console.log('✅ Token verified successfully:', {
            uid: decodedToken.uid,
            email: decodedToken.email
        });
        
        res.json({
            message: 'Token verified successfully',
            user: {
                uid: decodedToken.uid,
                email: decodedToken.email,
                displayName: decodedToken.name,
                photoURL: decodedToken.picture
            }
        });
    } catch (error) {
        console.error('❌ Token verification error:', error);
        res.status(401).json({ message: 'Invalid token' });
    }
});

// Check session status endpoint
router.get('/session-status', firebaseAuth, async (req, res) => {
    try {
        const firebaseUid = req.user.firebase_uid;
        
        // Check if session exists in Redis
        const sessionExists = await redis.exists(`session:${firebaseUid}`);
        
        res.json({
            message: 'Session status checked',
            sessionActive: !!sessionExists,
            user: {
                uid: firebaseUid,
                username: req.user.username,
                email: req.user.email
            }
        });
    } catch (error) {
        console.error('❌ Session status check error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Force logout all other sessions (useful for security)
router.post('/force-logout-others', firebaseAuth, async (req, res) => {
    try {
        const firebaseUid = req.user.firebase_uid;
        const currentSessionToken = req.headers.authorization?.split('Bearer ')[1];
        
        if (!currentSessionToken) {
            return res.status(400).json({ message: 'Current session token required' });
        }
        
        // Get all session keys for this user
        const allSessionKeys = await redis.keys(`session:${firebaseUid}`);
        let sessionsInvalidated = 0;
        
        for (const sessionKey of allSessionKeys) {
            const sessionToken = await redis.get(sessionKey);
            
            // Don't invalidate the current session
            if (sessionToken !== currentSessionToken) {
                await redis.del(sessionKey);
                sessionsInvalidated++;
                console.log(`🔄 Invalidated other session: ${sessionKey}`);
            }
        }
        
        res.json({
            message: 'Other sessions invalidated successfully',
            sessionsInvalidated: sessionsInvalidated,
            currentSessionActive: true
        });
        
    } catch (error) {
        console.error('❌ Force logout others error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
