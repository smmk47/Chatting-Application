const express = require('express');
const cors = require('cors');
const http = require('http');
const { sequelize, syncModels } = require('./models');
require('dotenv').config();

// Initialize Firebase Admin SDK first
require('./config/firebase');

const SocketManager = require('./socket');

const app = express();
const server = http.createServer(app);

// Middleware configuration
app.use(cors({
  origin: "*"
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Health check endpoint to verify database connectivity
 */
app.get('/api/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    const result = await sequelize.query('SELECT NOW()');
    
    res.json({ 
      status: 'OK', 
      database: 'Connected',
      timestamp: result[0][0].now 
    });
  } catch (err) {
    console.error('Health check error:', err);
    res.status(500).json({ 
      status: 'Error', 
      database: 'Disconnected',
      error: err.message 
    });
  }
});

/**
 * Root endpoint providing API documentation
 */
app.get('/', (req, res) => {
  res.json({
    message: 'Firebase Authentication & Chat API',
    version: '1.0.0',
    endpoints: {
      auth: {
        'POST /api/auth/signup': 'Create new user with Firebase',
        'POST /api/auth/login': 'Login with Firebase token',
        'GET /api/auth/profile': 'Get user profile',
        'PUT /api/auth/profile': 'Update user profile',
        'POST /api/auth/verify-token': 'Verify Firebase token',
        'GET /api/health': 'Health check'
      },
      chat: {
        'POST /api/chat/rooms': 'Create new chat room',
        'GET /api/chat/rooms': 'Get all chat rooms (public and private)',
        'GET /api/chat/rooms/public': 'Get all public chat rooms',
        'GET /api/chat/rooms/joined': 'Get user joined chat rooms',
        'GET /api/chat/rooms/:roomId': 'Get chat room details',
        'POST /api/chat/rooms/:roomId/join': 'Join a chat room',
        'POST /api/chat/rooms/:roomId/leave': 'Leave a chat room',
        'DELETE /api/chat/rooms/:roomId': 'Delete a chat room (owner only)',
        'GET /api/chat/rooms/:roomId/messages': 'Get chat messages',
        'POST /api/chat/rooms/:roomId/messages': 'Send a message'
      }
    }
  });
});

const PORT = process.env.PORT || 5000;

/**
 * Initialize database and start the server
 */
const startServer = async () => {
  try {
    // Sync Sequelize models with database
    await syncModels();
    
    // Start the server
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔥 Firebase Authentication API ready`);
      console.log(`🔌 Socket.io Real-time Chat ready`);
      
      // Initialize Socket.io after server starts
      const socketManager = new SocketManager(server);
      
      // Make socket manager available to routes
      app.set('socketManager', socketManager);
      
      // Also make it available globally for notification service
      global.socketManager = socketManager;
      
      // Register API routes after socket manager is available
      app.use('/api/auth', require('./routes/auth/index'));
      app.use('/api/chat', require('./routes/chat/index'));
      
      console.log('✅ Server initialization complete');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();