# Auth Routes - Modular Structure

This directory contains the modularized authentication routes that were previously in a single large `routes/auth.js` file. The routes are now organized into logical components for better maintainability and readability.

## File Structure

```
backend/routes/auth/
├── index.js              # Main router that combines all modules
├── auth.js               # Authentication operations (signup, login, logout, sessions)
├── profile.js            # Profile management operations (get, update with avatar)
└── README.md             # This documentation file
```

## Route Organization

### 1. Authentication (`auth.js`)
- `POST /signup` - Create new user with Firebase and PostgreSQL
- `POST /login` - Login with email/password and Firebase verification
- `POST /logout` - Logout and clear Redis session
- `POST /verify-token` - Verify Firebase ID token
- `GET /session-status` - Check current session status
- `POST /force-logout-others` - Invalidate other user sessions

### 2. Profile Management (`profile.js`)
- `GET /profile` - Get current user profile
- `PUT /profile` - Update user profile with optional avatar upload

## Benefits of Modular Structure

1. **Maintainability**: Each file has a single responsibility
2. **Readability**: Easier to find and modify specific functionality
3. **Scalability**: New features can be added to appropriate modules
4. **Testing**: Individual modules can be tested separately
5. **Code Organization**: Related functionality is grouped together

## Usage

The main `index.js` file automatically combines all route modules, so the API endpoints remain exactly the same. No changes are needed in the frontend or other parts of the application.

## Route Paths

All route paths and functionality remain identical to the original monolithic file. The modularization is purely internal and doesn't affect the external API interface.

## Dependencies

Each module imports only the dependencies it needs:
- **auth.js**: Express, Firebase admin, Redis, User model, Sequelize operators, firebaseAuth middleware
- **profile.js**: Express, User model, firebaseAuth middleware, Cloudinary, upload middleware, fs

## Features Preserved

### Authentication Features
- Firebase user creation and verification
- PostgreSQL user synchronization
- Redis session management
- Session conflict handling
- Force logout functionality
- Token verification

### Profile Features
- Profile retrieval
- Profile updates (display name, bio)
- Avatar upload to Cloudinary
- File cleanup and error handling
- Secure profile access

## Adding New Routes

To add new routes:
1. Determine which module they belong to based on functionality
2. Add the route to the appropriate module file
3. The route will automatically be available through the main index.js router

## Migration Notes

- All existing routes maintain their exact paths and functionality
- No breaking changes to the API
- Firebase authentication logic preserved
- Redis session management unchanged
- Cloudinary file upload functionality maintained
- Authentication middleware applied consistently across all modules

## Security Features

- Firebase authentication integration
- Session-based authentication with Redis
- Secure file upload handling
- Input validation and sanitization
- Error handling and logging
- Session invalidation capabilities
