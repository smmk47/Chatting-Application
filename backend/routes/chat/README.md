# Chat Routes - Modular Structure

This directory contains the modularized chat routes that were previously in a single large `routes/chat.js` file. The routes are now organized into logical components for better maintainability and readability.

## File Structure

```
backend/routes/chat/
├── index.js              # Main router that combines all modules
├── roomManagement.js     # Room CRUD operations (create, join, leave, delete)
├── roomQueries.js        # Room query operations (get all, public, joined, details)
├── messageManagement.js  # Message operations (send, get, file uploads)
├── utility.js            # Utility functions and test endpoints
└── README.md             # This documentation file
```

## Route Organization

### 1. Room Management (`roomManagement.js`)
- `POST /rooms` - Create a new chat room
- `POST /rooms/:roomId/join` - Join a chat room
- `POST /rooms/:roomId/leave` - Leave a chat room
- `DELETE /rooms/:roomId` - Delete a chat room (owner only)

### 2. Room Queries (`roomQueries.js`)
- `GET /rooms` - Get all chat rooms (public and private)
- `GET /rooms/public` - Get all public chat rooms
- `GET /rooms/joined` - Get user's joined chat rooms
- `GET /rooms/:roomId` - Get chat room details by ID

### 3. Message Management (`messageManagement.js`)
- `GET /rooms/:roomId/messages` - Get chat messages for a room
- `POST /rooms/:roomId/messages` - Send a text message to a room
- `POST /rooms/:roomId/upload` - Upload file and send as message

### 4. Utility (`utility.js`)
- `POST /test-broadcast/:roomId` - Test endpoint for socket broadcasting

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
- **roomManagement.js**: Express, bcrypt, models, firebaseAuth middleware
- **roomQueries.js**: Express, models, firebaseAuth middleware, sequelize functions
- **messageManagement.js**: Express, models, firebaseAuth middleware, upload middleware, cloudinary, fs
- **utility.js**: Express, firebaseAuth middleware

## Adding New Routes

To add new routes:
1. Determine which module they belong to based on functionality
2. Add the route to the appropriate module file
3. The route will automatically be available through the main index.js router

## Migration Notes

- All existing routes maintain their exact paths and functionality
- No breaking changes to the API
- Socket functionality is preserved in messageManagement.js
- File upload functionality remains unchanged
- Authentication middleware is applied consistently across all modules
