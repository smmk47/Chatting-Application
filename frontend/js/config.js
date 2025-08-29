// Configuration file for the Firebase Auth Frontend
const CONFIG = {
    // API Configuration
    API_BASE_URL: 'http://localhost:5000',
    API_ENDPOINTS: {
        // Auth endpoints
        SIGNUP: '/api/auth/signup',
        LOGIN: '/api/auth/login',
        PROFILE: '/api/auth/profile',
        LOGOUT: '/api/auth/logout',
        VERIFY_TOKEN: '/api/auth/verify-token',
        SESSION_STATUS: '/api/auth/session-status',
        HEALTH: '/api/health',
        
        // Chat endpoints
        CREATE_ROOM: '/api/chat/rooms',
        GET_ALL_ROOMS: '/api/chat/rooms',
        GET_PUBLIC_ROOMS: '/api/chat/rooms/public',
        GET_JOINED_ROOMS: '/api/chat/rooms/joined',
        GET_ROOM_DETAILS: '/api/chat/rooms',
        JOIN_ROOM: '/api/chat/rooms',
        LEAVE_ROOM: '/api/chat/rooms',
        DELETE_ROOM: '/api/chat/rooms',
        GET_MESSAGES: '/api/chat/rooms',
        SEND_MESSAGE: '/api/chat/rooms',
        UPLOAD_FILE: '/api/chat/rooms',
        

    },
    
    // App Configuration
    APP_NAME: 'Chat App',
    APP_VERSION: '2.0.0',
    
    // Session Configuration
    SESSION_STORAGE_KEY: 'firebase_auth_session',
    SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    
    // UI Configuration
    LOADING_TIMEOUT: 3000, // 3 seconds
    SUCCESS_MESSAGE_DURATION: 3000, // 3 seconds
    ERROR_MESSAGE_DURATION: 5000, // 5 seconds
    
    // File Upload Configuration
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    
    // Validation Configuration
    MIN_PASSWORD_LENGTH: 6,
    MAX_USERNAME_LENGTH: 50,
    MAX_DISPLAY_NAME_LENGTH: 100,
    MAX_BIO_LENGTH: 500,
    
    // Firebase Cloud Messaging Configuration
    // IMPORTANT: Get this from Firebase Console → Project Settings → Cloud Messaging → Web Push certificates
    // Generate a new VAPID key pair if none exists
    FCM_VAPID_KEY: 'BGwJFyz3aqUyyUWTSJDuQETPpQyu-VHejnd5hfSbsrIaF0SRu7qpvwHAa9AMnR6ioTVU2netG5yLhwz33cn4teU', // VAPID key from Firebase Console
    
    // Notification Configuration
    NOTIFICATION_TIMEOUT: 5000, // 5 seconds
    NOTIFICATION_AUTO_CLOSE: true,
    NOTIFICATION_SOUND: true

};

// Helper function to get full API URL
function getApiUrl(endpoint) {
    return CONFIG.API_BASE_URL + endpoint;
}

// Helper function to get API endpoint
function getEndpoint(name) {
    return CONFIG.API_ENDPOINTS[name] || '';
}

// Export configuration
window.CONFIG = CONFIG;
window.getApiUrl = getApiUrl;
window.getEndpoint = getEndpoint;

console.log('✅ Configuration loaded:', CONFIG);
