const admin = require('firebase-admin');
require('dotenv').config();

// Check if Firebase environment variables are set
const hasFirebaseConfig = process.env.FIREBASE_PROJECT_ID && 
                         process.env.FIREBASE_PRIVATE_KEY && 
                         process.env.FIREBASE_CLIENT_EMAIL;

if (hasFirebaseConfig) {
  // Initialize Firebase Admin SDK with service account
  const serviceAccount = {
    type: process.env.FIREBASE_TYPE || "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI || "https://accounts.google.com/o/oauth2/auth",
    token_uri: process.env.FIREBASE_TOKEN_URI || "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL || "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
  };

  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL
    });
    console.log('✅ Firebase Admin SDK initialized with service account');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
    process.exit(1);
  }
} else {
  // For development without Firebase Admin SDK
  console.log('⚠️ Firebase Admin SDK not configured. Using mock authentication for development.');
  
  // Create a mock admin object for development
  const mockAdmin = {
    auth: () => ({
      verifyIdToken: async (token) => {
        // Mock token verification for development
        if (token && token.length > 10) {
          return {
            uid: 'mock_uid_' + Date.now(),
            email: 'mock@example.com',
            displayName: 'Mock User',
            photoURL: null
          };
        }
        throw new Error('Invalid token');
      }
    })
  };
  
  module.exports = mockAdmin;
  return;
}

// Export Firebase Admin instance
module.exports = admin;
