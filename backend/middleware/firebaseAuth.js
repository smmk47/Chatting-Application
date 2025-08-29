const admin = require('../config/firebase');
const redis = require('../config/redis');
const { User } = require('../models');

const firebaseAuth = async (req, res, next) => {
  try {
    console.log('🔐 Firebase auth middleware called');
    
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ No authorization header or invalid format');
      return res.status(401).json({ 
        message: 'No token provided or invalid format' 
      });
    }

    const token = authHeader.split('Bearer ')[1];
    
    if (!token || token.length < 10) {
      console.error('❌ Invalid token format');
      return res.status(401).json({ 
        message: 'Invalid token format' 
      });
    }
    
    let firebaseUid = null;
    
    // Check if this is a session token or Firebase ID token
    if (token.startsWith('session_')) {
      // This is a session token, verify it from Redis
      console.log('🔑 Session token detected, verifying from Redis...');
      
      // Find user by session token in Redis
      const keys = await redis.keys('session:*');
      for (const key of keys) {
        const sessionToken = await redis.get(key);
        if (sessionToken === token) {
          firebaseUid = key.split('session:')[1];
          break;
        }
      }
      
      if (!firebaseUid) {
        console.error('❌ Session token not found in Redis');
        return res.status(401).json({ 
          message: 'Session expired or invalid, please login again' 
        });
      }
      
      console.log('✅ Session token verified for user:', firebaseUid);
      
    } else {
      // This is a Firebase ID token, verify it
      console.log('🔥 Firebase ID token detected, verifying with Firebase...');
      
      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        firebaseUid = decodedToken.uid;
        console.log('✅ Firebase token verified for user:', firebaseUid);
      } catch (firebaseError) {
        console.error('❌ Firebase token verification failed:', firebaseError.message);
        return res.status(401).json({ 
          message: 'Invalid Firebase token' 
        });
      }
    }
    
    // Get user from database
    const user = await User.findOne({
      where: { firebase_uid: firebaseUid }
    });
    
    if (!user) {
      console.error('❌ User not found in database');
      return res.status(401).json({ 
        message: 'User not found' 
      });
    }
    
    // Set user in request (convert to plain object)
    req.user = user.toJSON();
    
    // Store session in Redis (if using Firebase token)
    if (!token.startsWith('session_')) {
      await storeSessionInRedis(firebaseUid, token);
    }
    
    next();
  } catch (error) {
    console.error('❌ Auth middleware error:', error.message);
    
    // Handle Firebase-specific errors
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ 
        message: 'Token expired, please login again' 
      });
    }
    
    if (error.code === 'auth/id-token-revoked') {
      return res.status(401).json({ 
        message: 'Token revoked, please login again' 
      });
    }
    
    if (error.code === 'auth/argument-error') {
      return res.status(401).json({ 
        message: 'Invalid token format. Please try logging in again.' 
      });
    }
    
    // Handle general errors
    return res.status(401).json({ 
      message: 'Authentication failed. Please try logging in again.' 
    });
  }
};

const createUserFromFirebase = async (decodedToken) => {
  const { uid, email, displayName, photoURL } = decodedToken;
  
  // Generate username from email if displayName is not available
  const username = displayName || email.split('@')[0];
  
  const user = await User.create({
    firebase_uid: uid,
    username: username,
    email: email,
    display_name: displayName,
    avatar_url: photoURL
  });
  
  return user;
};

const storeSessionInRedis = async (firebaseUid, idToken) => {
  try {
    // Store session in Redis with expiration (24 hours)
    await redis.setEx(`session:${firebaseUid}`, 86400, idToken);
    console.log('✅ Session stored in Redis for user:', firebaseUid);
  } catch (error) {
    console.error('❌ Error storing session in Redis:', error.message);
    // Continue even if Redis fails
  }
};

const checkSession = async (firebaseUid) => {
  try {
    const session = await redis.get(`session:${firebaseUid}`);
    return !!session;
  } catch (error) {
    console.error('❌ Error checking session in Redis:', error.message);
    return false;
  }
};

module.exports = { firebaseAuth, checkSession };
