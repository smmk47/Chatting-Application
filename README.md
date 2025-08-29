# 🚀 Real-Time Chat Application

A modern, full-stack real-time chat application built with Node.js, Socket.io, Firebase Authentication, and PostgreSQL. Features include real-time messaging, file sharing, push notifications, and a responsive web interface.

> **Onboarding project** - A comprehensive chat application built to demonstrate full-stack development skills, real-time communication, and modern web technologies.

## ✨ Features

- **🔐 Firebase Authentication** - Secure user authentication and session management
- **💬 Real-Time Chat** - Instant messaging using Socket.io WebSockets
- **📁 File Sharing** - Support for images, documents, and other file types
- **🔔 Push Notifications** - Firebase Cloud Messaging (FCM) for mobile and web
- **🏠 Chat Rooms** - Public and private chat rooms with password protection
- **👥 User Management** - User profiles, avatars, and status tracking
- **📱 Responsive Design** - Mobile-friendly interface with modern UI
- **🔒 Security** - JWT tokens, Firebase auth, and input validation

## 🏗️ Architecture

### Backend (Node.js + Express)
- **Server**: Express.js with Socket.io for real-time communication
- **Database**: PostgreSQL with Sequelize ORM
- **Authentication**: Firebase Admin SDK
- **File Storage**: Cloudinary for file uploads
- **Notifications**: Firebase Cloud Messaging (FCM)
- **Caching**: Redis for session management

### Frontend (Vanilla JavaScript)
- **UI Framework**: Custom CSS with responsive design
- **Real-time**: Socket.io client for WebSocket connections
- **Authentication**: Firebase client SDK
- **State Management**: Custom manager classes for different features

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- PostgreSQL database
- Redis server
- Firebase project with Admin SDK
- Cloudinary account

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Chat-App
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the backend directory:
   ```env
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=chat_app
   DB_USER=postgres
   DB_PASSWORD=your_password

   # JWT Configuration
   JWT_SECRET=your_jwt_secret
   JWT_EXPIRES_IN=24h

   # CORS Configuration
   CORS_ORIGIN=http://localhost:3000

   # Firebase Admin SDK Configuration
   FIREBASE_PROJECT_ID=your_project_id
   FIREBASE_PRIVATE_KEY="your_private_key"
   FIREBASE_CLIENT_EMAIL=your_client_email

   # Redis Configuration
   REDIS_HOST=localhost
   REDIS_PORT=6379

   # Cloudinary Configuration
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret

   # FCM Configuration
   FCM_VAPID_KEY=your_vapid_key
   ```

4. **Set up the database**
   ```bash
   npm run migrate
   npm run seed
   ```

5. **Start the backend server**
   ```bash
   npm start
   ```

6. **Open the frontend**
   - Open `frontend/index.html` in your browser
   - Or serve it using a local server

## 💬 Chat System

### Real-Time Messaging
The chat system uses **Socket.io** to provide real-time communication between users:

1. **Connection Management**
   - Users connect via WebSocket when they join a room
   - Authentication is handled using Firebase tokens
   - Connection status is tracked and displayed

2. **Room Management**
   - Users can join/leave chat rooms
   - Room membership is verified before allowing access
   - Real-time updates when users join/leave

3. **Message Broadcasting**
   - Messages are sent via both HTTP API and WebSocket
   - Real-time delivery to all users in the room
   - Support for text messages and file uploads

4. **Message Types**
   - **Text Messages**: Plain text with character limits
   - **File Messages**: Images, documents, and other files
   - **System Messages**: User join/leave notifications

### Message Flow
```
User sends message → Backend validates → Saves to database → 
Broadcasts via Socket.io → All connected users receive → 
UI updates in real-time
```

### File Handling
- **Upload Process**: File → Multer → Cloudinary → Database
- **Supported Types**: Images, PDFs, documents, archives
- **Size Limits**: 5MB maximum file size
- **Security**: File type validation and sanitization

## 🔔 Notification System

### Firebase Cloud Messaging (FCM)
The notification system uses FCM to send push notifications to users:

1. **Notification Types**
   - **Chat Messages**: When someone sends a message
 

2. **Smart Filtering**
   - **Active Users**: Users currently in the room don't receive notifications
   - **Sender Exclusion**: Message sender never receives their own notifications
   - **Token Validation**: Only users with valid FCM tokens receive notifications

3. **Notification Content**
   - **Title**: Sender's name and action type
   - **Body**: Message preview or file description
   - **Image**: User avatar or file preview (for images)
   - **Data**: Additional context for app handling

### Notification Flow
```
Message sent → Check user status → Filter recipients → 
Prepare notification → Send via FCM → Users receive push notification
```

### FCM Setup
1. **Firebase Console**: Enable Cloud Messaging
2. **VAPID Key**: Generate and configure in environment
3. **Service Worker**: Configure for web push notifications
4. **Token Management**: Store and update user FCM tokens

## 🔐 Authentication System

### Firebase Integration
- **Client SDK**: Handles user login/signup
- **Admin SDK**: Verifies tokens on the backend
- **Session Management**: Redis-based session storage
- **Token Refresh**: Automatic token renewal

### Security Features
- **Input Validation**: Server-side validation for all inputs
- **SQL Injection Protection**: Sequelize ORM with parameterized queries
- **XSS Prevention**: Content sanitization and validation
- **CORS Protection**: Configurable cross-origin restrictions

## 📊 Database Schema

### Core Tables
- **Users**: User profiles and authentication data
- **ChatRooms**: Room information and settings
- **RoomMembers**: User-room relationships
- **ChatMessages**: Message content and metadata

### Relationships
- Users can join multiple rooms
- Messages belong to rooms and users
- FCM tokens are linked to users
- Room membership controls access

## 🎨 Frontend Features

### User Interface
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Modern UI**: Clean, intuitive interface with animations
- **Real-time Updates**: Live message delivery and status changes
- **File Preview**: Image previews and file type icons

### User Experience
- **Typing Indicators**: Shows when someone is typing
- **Message Status**: Sent, delivered, and read indicators
- **Room Navigation**: Easy switching between chat rooms
- **Search Functionality**: Find rooms and messages quickly

## 🚀 API Endpoints

### Authentication
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile

### Chat Rooms
- `POST /api/chat/rooms` - Create new room
- `GET /api/chat/rooms` - Get all rooms
- `GET /api/chat/rooms/:id` - Get room details
- `POST /api/chat/rooms/:id/join` - Join room
- `POST /api/chat/rooms/:id/leave` - Leave room

### Messages
- `GET /api/chat/rooms/:id/messages` - Get room messages
- `POST /api/chat/rooms/:id/messages` - Send text message
- `POST /api/chat/rooms/:id/upload` - Upload file

## 🔧 Configuration

### Environment Variables
- **Database**: PostgreSQL connection settings
- **Firebase**: Project credentials and configuration
- **Cloudinary**: File storage settings
- **Redis**: Cache and session configuration
- **FCM**: Push notification settings

### CORS Settings
- **Development**: `http://localhost:3000`
- **Production**: Configure for your domain
- **Methods**: GET, POST, PUT, DELETE
- **Credentials**: Enabled for authentication

## 🧪 Testing

### Manual Testing
1. **Authentication**: Test login/signup flows
2. **Chat**: Send messages between multiple users
3. **File Upload**: Test various file types and sizes
4. **Notifications**: Verify push notification delivery
5. **Real-time**: Test WebSocket connections and updates

### Debug Tools
- **Socket Status**: Real-time connection status display
- **Console Logs**: Detailed logging for troubleshooting
- **Network Tab**: Monitor API calls and WebSocket traffic



## 🎓 Project Context

This chat application was built as part of my **onboarding project** to demonstrate:

- **Full-Stack Development**: Backend (Node.js/Express) + Frontend (Vanilla JS)
- **Real-Time Communication**: Socket.io WebSocket implementation
- **Modern Authentication**: Firebase integration with security best practices
- **Database Design**: PostgreSQL with Sequelize ORM
- **File Management**: Cloudinary integration for file uploads
- **Push Notifications**: FCM implementation for mobile/web
- **API Design**: RESTful endpoints with proper error handling
- **Real-Time Features**: Live messaging, typing indicators, user status




