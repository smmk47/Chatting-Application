/**
 * Chat Manager Module
 * Handles all chat functionality including rooms, messages, and real-time updates
 */
class ChatManager {
    constructor() {
        this.currentRoom = null;
        this.rooms = [];
        this.joinedRooms = [];
        this.messages = [];
        this.isInitialized = false;
        
        this.initializeChat();
        this.bindEvents();
    }
    
    /**
     * Initialize chat functionality
     */
    initializeChat() {
        this.isInitialized = true;
    }
    
    /**
     * Bind event listeners to DOM elements
     */
    bindEvents() {
        // Room creation form
        const createRoomForm = document.getElementById('createRoomForm');
        if (createRoomForm) {
            createRoomForm.addEventListener('submit', (e) => this.handleCreateRoom(e));
        }
        
        // Room search
        const roomSearchInput = document.getElementById('roomSearch');
        if (roomSearchInput) {
            roomSearchInput.addEventListener('input', (e) => this.handleRoomSearch(e));
        }
        
        // Message form
        const messageForm = document.getElementById('messageForm');
        if (messageForm) {
            messageForm.addEventListener('submit', (e) => this.handleSendMessage(e));
        }
        
        // File input
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }
        
        // Setup typing indicators for message input
        this.setupTypingIndicators();
    }
    
    /**
     * Setup typing indicators for real-time feedback
     */
    setupTypingIndicators() {
        const messageInput = document.getElementById('messageInput');
        if (!messageInput) return;
        
        let typingTimeout;
        
        messageInput.addEventListener('input', () => {
            // Start typing indicator if socket is available
            if (window.socketClient && window.socketClient.isSocketConnected()) {
                window.socketClient.startTyping();
                
                // Clear existing timeout
                if (typingTimeout) {
                    clearTimeout(typingTimeout);
                }
                
                // Set timeout to stop typing indicator
                typingTimeout = setTimeout(() => {
                    window.socketClient.stopTyping();
                }, 2000);
            }
        });
        
        // Stop typing when input loses focus
        messageInput.addEventListener('blur', () => {
            if (typingTimeout) {
                clearTimeout(typingTimeout);
            }
            if (window.socketClient && window.socketClient.isSocketConnected()) {
                window.socketClient.stopTyping();
            }
        });
    }
    
    /**
     * Load all available chat rooms
     */
    async loadAllRooms() {
        try {
            const response = await fetch(getApiUrl(getEndpoint('GET_ALL_ROOMS')), {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load rooms');
            }
            
            const data = await response.json();
            this.rooms = data.rooms;
            
            this.displayRooms(this.rooms);
            
        } catch (error) {
            console.error('❌ Load rooms error:', error);
            this.showError('Failed to load chat rooms');
        }
    }
    
    /**
     * Load public rooms only
     */
    async loadPublicRooms() {
        try {
            const response = await fetch(getApiUrl(getEndpoint('GET_PUBLIC_ROOMS')), {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load public rooms');
            }
            
            const data = await response.json();
            const publicRooms = data.rooms.filter(room => !room.is_private);
            
            this.displayPublicRooms(publicRooms);
            
        } catch (error) {
            console.error('❌ Load public rooms error:', error);
            this.showError('Failed to load public chat rooms');
        }
    }
    
    /**
     * Load user's joined rooms
     */
    async loadJoinedRooms() {
        try {
            // Check if auth manager is available
            if (!window.authManager) {
                throw new Error('Authentication manager not available');
            }
            
            // Check if user is authenticated
            if (!window.authManager.isAuthenticated) {
                throw new Error('User not authenticated');
            }
            
            const token = window.authManager.getSessionToken();
            if (!token) {
                throw new Error('No authentication token');
            }
            
            const response = await fetch(getApiUrl(getEndpoint('GET_JOINED_ROOMS')), {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load joined rooms');
            }
            
            const data = await response.json();
            this.joinedRooms = data.rooms || [];
            
            this.displayJoinedRooms();
            
        } catch (error) {
            console.error('❌ Load joined rooms error:', error);
            this.showError('Failed to load joined rooms');
        }
    }
    // Handle user leaving a room
async handleLeaveRoom(socket, data) {
    try {
        const { roomId } = data;
        const { firebase_uid } = socket.user;
        
        // Get user info for broadcast BEFORE leaving
        const userInfo = await this.getUserInfo(firebase_uid);
        
        // Broadcast user left to room BEFORE the user actually leaves
        this.io.to(`room_${roomId}`).emit('user_left', {
            roomId,
            user: userInfo,
            timestamp: new Date()
        });
        
        // Now leave the socket room
        socket.leave(`room_${roomId}`);
        
        // Update room tracking
        this.removeUserFromRoom(firebase_uid, roomId);
        
        // Send confirmation to user
        socket.emit('room_left', {
            roomId,
            message: 'Successfully left room'
        });
        
    } catch (error) {
        console.error('❌ Leave room error:', error);
        socket.emit('error', { message: 'Failed to leave room' });
    }
}

    // Create a new chat room
    async handleCreateRoom(e) {
        e.preventDefault();
        
        try {
            const formData = new FormData(e.target);
            const roomData = {
                name: formData.get('roomName').trim(),
                description: formData.get('roomDescription').trim(),
                is_private: formData.get('isPrivate') === 'true',
                max_members: parseInt(formData.get('maxMembers')) || 100
            };
            
            // Add password if private
            if (roomData.is_private) {
                const password = formData.get('roomPassword');
                if (!password || password.length < 4) {
                    this.showError('Private rooms require a password (min 4 characters)');
                    return;
                }
                roomData.password = password;
            }
            
            // Validation
            if (!roomData.name || roomData.name.length < 3) {
                this.showError('Room name must be at least 3 characters long');
                return;
            }
            
            if (roomData.name.length > 100) {
                this.showError('Room name must be less than 100 characters');
                return;
            }
            
            const token = window.authManager?.getSessionToken();
            if (!token) {
                throw new Error('No authentication token');
            }
            
            const response = await fetch(getApiUrl(getEndpoint('CREATE_ROOM')), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(roomData)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to create room');
            }
            
            const data = await response.json();
            
            // Show success message
            this.showSuccess('Chat room created successfully!');
            
            // Reset form
            e.target.reset();
            
            // Reload rooms
            await this.loadAllRooms();
            await this.loadJoinedRooms();
            
            // Switch to rooms view
            this.showRoomsView();
            
        } catch (error) {
            console.error('❌ Create room error:', error);
            this.showError(error.message || 'Failed to create chat room');
        }
    }
    
    // Join a chat room
    async joinRoom(roomId, password = null) {
        try {
            const token = window.authManager?.getSessionToken();
            if (!token) {
                throw new Error('No authentication token');
            }
            
            const requestBody = {};
            if (password) {
                requestBody.password = password;
            }
            
            const response = await fetch(getApiUrl(getEndpoint('JOIN_ROOM')) + `/${roomId}/join`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to join room');
            }
            
            const data = await response.json();
            
            // Show success message
            this.showSuccess('Successfully joined the chat room!');
            
            // Reload joined rooms
            await this.loadJoinedRooms();
            
            // Enter the room
            await this.enterRoom(roomId);
            
        } catch (error) {
            console.error('❌ Join room error:', error);
            this.showError(error.message || 'Failed to join chat room');
        }
    }
    
    // Leave a chat room
    // async leaveRoom(roomId) {
    //     try {
    //         console.log(`🚪 Leaving room ${roomId}...`);
            
    //         const token = window.authManager?.getSessionToken();
    //         if (!token) {
    //             throw new Error('No authentication token');
    //         }
            
    //         const response = await fetch(getApiUrl(getEndpoint('LEAVE_ROOM')) + `/${roomId}/leave`, {
    //             method: 'POST',
    //             headers: {
    //                 'Authorization': `Bearer ${token}`,
    //                 'Content-Type': 'application/json'
    //             }
    //         });
            
    //         if (!response.ok) {
    //             const errorData = await response.json();
    //             throw new Error(errorData.message || 'Failed to leave room');
    //         }
            
    //         const data = await response.json();
    //         console.log('✅ Left room:', data.message);
            
    //         // Show success message
    //         this.showSuccess('Successfully left the chat room');
            
    //         // Reload joined rooms
    //         await this.loadJoinedRooms();
            
    //         // If we were in that room, go back to rooms view
    //         if (this.currentRoom && this.currentRoom.id === roomId) {
    //             this.showRoomsView();
    //         }
            
    //     } catch (error) {
    //         console.error('❌ Leave room error:', error);
    //         this.showError(error.message || 'Failed to leave chat room');
    //     }
    // }
    
// Leave a chat room
async leaveRoom(roomId) {
    try {
        console.log(`🚪 Leaving room ${roomId}...`);
        
        const token = window.authManager?.getSessionToken();
        if (!token) {
            throw new Error('No authentication token');
        }
        
        // First, leave the room via Socket.io to notify other users in real-time
        if (window.socketClient && window.socketClient.isSocketConnected()) {
            window.socketClient.leaveRoom(roomId);
        }
        
        const response = await fetch(getApiUrl(getEndpoint('LEAVE_ROOM')) + `/${roomId}/leave`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to leave room');
        }
        
        const data = await response.json();
        console.log('✅ Left room:', data.message);
        
        // Show success message
        this.showSuccess('Successfully left the chat room');
        
        // Reload joined rooms
        await this.loadJoinedRooms();
        
        // If we were in that room, go back to rooms view
        if (this.currentRoom && this.currentRoom.id === roomId) {
            this.showRoomsView();
        }
        
    } catch (error) {
        console.error('❌ Leave room error:', error);
        this.showError(error.message || 'Failed to leave chat room');
    }
}

    // Enter a chat room
    async enterRoom(roomId) {
        try {
            const token = window.authManager?.getSessionToken();
            if (!token) {
                throw new Error('No authentication token');
            }
            
            // Get room details
            const response = await fetch(getApiUrl(getEndpoint('GET_ROOM_DETAILS')) + `/${roomId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to get room details');
            }
            
            const data = await response.json();
            this.currentRoom = data.room;
            
            // Load messages
            await this.loadMessages(roomId);
            
            // Update room display information
            this.updateRoomDisplay();
            
            // Join room via Socket.io for real-time updates
            if (window.socketClient) {
                const joined = window.socketClient.joinRoom(roomId);
                if (joined) {
                    // Setup real-time event listeners
                    this.setupSocketEventListeners();
                } else {
                    console.warn('⚠️ Failed to join room via Socket.io');
                }
            }
            
            // Show chat view
            this.showChatView();
            
        } catch (error) {
            console.error('❌ Enter room error:', error);
            this.showError('Failed to enter chat room');
        }
    }
    
    // Load chat messages
    async loadMessages(roomId, limit = 50, offset = 0) {
        try {
            const token = window.authManager?.getSessionToken();
            if (!token) {
                throw new Error('No authentication token');
            }
            
            const response = await fetch(getApiUrl(getEndpoint('GET_MESSAGES')) + `/${roomId}/messages?limit=${limit}&offset=${offset}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load messages');
            }
            
            const data = await response.json();
            
            if (data.messages && data.messages.length > 0) {
                // Check for file messages in the loaded data
                const fileMessages = data.messages.filter(msg => msg.file_url);
                if (fileMessages.length > 0) {
                }
            } else {
            }
            
            this.messages = data.messages || [];
            
            this.displayMessages();
            
        } catch (error) {
            console.error('❌ Load messages error:', error);
            
            // Log additional debugging information
            console.log('🔍 Debug info:');
            console.log('  - Room ID:', roomId);
            console.log('  - Current Room:', this.currentRoom);
            console.log('  - Auth Token:', !!window.authManager?.getSessionToken());
            
            this.showError('Failed to load chat messages');
        }
    }
    
    // Handle file selection
    handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        // Validate file size (5MB limit)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            this.showError('File size too large (max 5MB)');
            e.target.value = '';
            return;
        }
        
        // Show file preview
        this.showFilePreview(file);
    }
    
    // Show file preview
    showFilePreview(file) {
        const filePreview = document.getElementById('filePreview');
        const fileName = document.getElementById('fileName');
        const fileSize = document.getElementById('fileSize');
        
        if (filePreview && fileName && fileSize) {
            fileName.textContent = file.name;
            fileSize.textContent = this.formatFileSize(file.size);
            filePreview.classList.remove('hidden');
        }
    }
    
    // Remove file
    removeFile() {
        const fileInput = document.getElementById('fileInput');
        const filePreview = document.getElementById('filePreview');
        
        if (fileInput) {
            fileInput.value = '';
        }
        if (filePreview) {
            filePreview.classList.add('hidden');
        }
    }
    
    // Format file size
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // Get file icon based on type
    getFileIcon(fileType) {
        if (fileType.startsWith('image/')) {
            return 'fas fa-image';
        } else if (fileType === 'application/pdf') {
            return 'fas fa-file-pdf';
        } else if (fileType.includes('word') || fileType.includes('document')) {
            return 'fas fa-file-word';
        } else if (fileType.includes('excel') || fileType.includes('spreadsheet')) {
            return 'fas fa-file-excel';
        } else if (fileType.includes('powerpoint') || fileType.includes('presentation')) {
            return 'fas fa-file-powerpoint';
        } else if (fileType.startsWith('text/')) {
            return 'fas fa-file-alt';
        } else if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('7z')) {
            return 'fas fa-file-archive';
        } else {
            return 'fas fa-file';
        }
    }
    
    // Send a message
    async handleSendMessage(e) {
        e.preventDefault();
        
        try {
            if (!this.currentRoom) {
                throw new Error('No active chat room');
            }
            
            const formData = new FormData(e.target);
            const message = formData.get('message').trim();
            const fileInput = document.getElementById('fileInput');
            const file = fileInput.files[0];
            
            // Check if we have a message or file
            if (!message && !file) {
                this.showError('Please enter a message or select a file');
                return;
            }
            
            if (message && message.length > 1000) {
                this.showError('Message too long (max 1000 characters)');
                return;
            }
            
            // If there's a file, upload it first
            if (file) {
                await this.uploadFileAndSendMessage(file, message);
            } else {
                // Send text message only
                await this.sendTextMessage(message);
            }
            
            // Reset form
            e.target.reset();
            this.removeFile();
            
        } catch (error) {
            console.error('❌ Send message error:', error);
            this.showError(error.message || 'Failed to send message');
        }
    }
    
    // Upload file and send message
    async uploadFileAndSendMessage(file, message) {
        try {
            const token = window.authManager?.getSessionToken();
            if (!token) {
                throw new Error('No authentication token');
            }
            
            const formData = new FormData();
            formData.append('file', file);
            if (message) {
                formData.append('message', message);
            }
            
            const response = await fetch(getApiUrl(getEndpoint('SEND_MESSAGE')) + `/${this.currentRoom.id}/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to upload file');
            }
            
            const data = await response.json();
            
            // Add message to local messages
            const newMessage = this.validateMessageData(data.chatMessage);
            if (newMessage) {
                this.messages.push(newMessage);
                this.displayMessages();
                this.scrollToBottom();
            }
            
        } catch (error) {
            console.error('❌ File upload error:', error);
            throw error;
        }
    }
    
    // Send text message only
    async sendTextMessage(message) {
        try {
            // Show sending indicator
            this.showSendingIndicator();
            
            // Try to send via Socket.io first (real-time)
            if (window.socketClient && window.socketClient.isSocketConnected()) {
                const sent = window.socketClient.sendMessage(message, 'text');
                if (sent) {
                    // Don't return here - wait for message_sent confirmation
                    // The UI will be updated when the confirmation arrives
                } else {
                    console.warn('⚠️ Socket.io send failed, falling back to HTTP API');
                }
            }
            
            // Fallback to HTTP API
            const token = window.authManager?.getSessionToken();
            if (!token) {
                throw new Error('No authentication token');
            }
            
            const response = await fetch(getApiUrl(getEndpoint('SEND_MESSAGE')) + `/${this.currentRoom.id}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    message_type: 'text'
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to send message');
            }
            
            const data = await response.json();
            
            // Add message to local messages
            const newMessage = this.validateMessageData(data.chatMessage);
            if (newMessage) {
                this.messages.push(newMessage);
                this.displayMessages();
                this.scrollToBottom();
            }
            
        } catch (error) {
            console.error('❌ Send text message error:', error);
            throw error;
        }
    }
    
    // Display rooms in the UI
    displayRooms(rooms) {
        const roomsContainer = document.getElementById('roomsContainer');
        if (!roomsContainer) return;
        
        if (rooms.length === 0) {
            roomsContainer.innerHTML = '<p class="no-rooms">No chat rooms available</p>';
            return;
        }
        
        const roomsHTML = rooms.map(room => `
            <div class="room-card ${room.is_private ? 'private' : 'public'}">
                <div class="room-header">
                    <h3 class="room-name">
                        ${room.name}
                        ${room.is_private ? '<i class="fas fa-lock" title="Private Room"></i>' : '<i class="fas fa-globe" title="Public Room"></i>'}
                    </h3>
                    <span class="room-members">${room.current_members}/${room.max_members} members</span>
                </div>
                <p class="room-description">${room.description || 'No description'}</p>
                <div class="room-footer">
                    <span class="room-created-by">Created by: ${room.created_by_username || 'Unknown'}</span>
                    <button class="btn btn-primary btn-sm" onclick="window.chatManager.joinRoomPrompt(${room.id}, ${room.is_private})">
                        ${room.is_private ? 'Join Private' : 'Join Room'}
                    </button>
                </div>
            </div>
        `).join('');
        
        roomsContainer.innerHTML = roomsHTML;
    }
    
    // Display public rooms
    displayPublicRooms(rooms) {
        const publicContainer = document.getElementById('publicRoomsGrid');
        if (!publicContainer) return;
        
        if (rooms.length === 0) {
            publicContainer.innerHTML = '<p class="no-rooms">No public chat rooms available</p>';
            return;
        }
        
        const roomsHTML = rooms.map(room => `
            <div class="room-card ${room.is_private ? 'private' : 'public'}">
                <div class="room-header">
                    <h3 class="room-name">
                        ${room.name}
                        ${room.is_private ? '<i class="fas fa-lock" title="Private Room"></i>' : '<i class="fas fa-globe" title="Public Room"></i>'}
                    </h3>
                    <span class="room-members">${room.current_members}/${room.max_members} members</span>
                </div>
                <p class="room-description">${room.description || 'No description'}</p>
                <div class="room-footer">
                    <span class="room-created-by">Created by: ${room.created_by_username || 'Unknown'}</span>
                    <button class="btn btn-primary btn-sm" onclick="window.chatManager.joinRoomPrompt(${room.id}, ${room.is_private})">
                        ${room.is_private ? 'Join Private' : 'Join Room'}
                    </button>
                </div>
            </div>
        `).join('');
        
        publicContainer.innerHTML = roomsHTML;
    }
    
    // Display joined rooms
    displayJoinedRooms() {
        const joinedContainer = document.getElementById('joinedRoomsGrid');
        
        if (!joinedContainer) {
            console.error('❌ Joined rooms container not found!');
            return;
        }
        
        if (this.joinedRooms.length === 0) {
            joinedContainer.innerHTML = '<p class="no-rooms">You haven\'t joined any rooms yet</p>';
            return;
        }
        
        const roomsHTML = this.joinedRooms.map(room => `
            <div class="room-card joined ${room.is_private ? 'private' : 'public'}">
                <div class="room-header">
                    <h3 class="room-name">
                        ${room.name}
                        ${room.is_private ? '<i class="fas fa-lock" title="Private Room"></i>' : '<i class="fas fa-globe" title="Public Room"></i>'}
                        ${room.is_owner ? '<i class="fas fa-crown" title="Room Owner"></i>' : ''}
                    </h3>
                    <span class="room-members">${room.current_members}/${room.max_members} members</span>
                </div>
                <p class="room-description">${room.description || 'No description'}</p>
                <div class="room-footer">
                    <span class="room-joined">Joined: ${new Date(room.joined_at).toLocaleDateString()}</span>
                    <div class="room-actions">
                        <button class="btn btn-primary btn-sm" onclick="window.chatManager.enterRoom(${room.id})">
                            Enter Room
                        </button>
                        ${!room.is_owner ? `<button class="btn btn-secondary btn-sm" onclick="window.chatManager.leaveRoom(${room.id})">Leave</button>` : ''}
                    </div>
                </div>
            </div>
        `).join('');
        
        joinedContainer.innerHTML = roomsHTML;
    }
    
    // Display messages in the UI
    displayMessages() {
        const messagesContainer = document.getElementById('messagesContainer');
        
        if (!messagesContainer) {
            console.error('❌ [DISPLAY] Messages container not found!');
            return;
        }
        
        if (this.messages.length === 0) {
            messagesContainer.innerHTML = '<p class="no-messages">No messages yet. Start the conversation!</p>';
            return;
        }
        
        const messagesHTML = this.messages
            .filter(msg => {
                // Filter out malformed messages
                if (!msg || !msg.message || !msg.created_at) {
                    return false;
                }
                return true;
            })
            .map(msg => {
                // Handle both message formats (GET vs POST response)
                const userInfo = msg.user || {
                    username: msg.username || 'Unknown',
                    display_name: msg.display_name || msg.username || 'Unknown User',
                    avatar_url: msg.avatar_url || null
                };
                
                // Check if this is the current user's message
                const currentUser = window.authManager?.getCurrentUser();
                
                const isOwnMessage = currentUser && currentUser.firebase_uid && 
                    msg.firebase_uid === currentUser.firebase_uid;
                
                // Ensure we have safe values for display
                const safeUsername = userInfo.username || 'Unknown User';
                const safeDisplayName = userInfo.display_name || safeUsername;
                const safeAvatar = userInfo.avatar_url || 'https://via.placeholder.com/32/667eea/ffffff?text=U';
                
                // Build message content
                let messageContent = `<div class="message-content">${msg.message}</div>`;
                
                // Add file content if it's a file message (check for file_url instead of message_type)
                if (msg.file_url && msg.file_name) {
                    const fileContent = this.renderFileMessage(msg);
                    messageContent += fileContent;
                }
                
                return `
                    <div class="message ${isOwnMessage ? 'own-message' : 'other-message'}">
                        <div class="message-header">
                            <img src="${safeAvatar}" 
                                 alt="${safeUsername}" class="message-avatar">
                            <span class="message-username">${safeDisplayName}</span>
                            <span class="message-time">${new Date(msg.created_at).toLocaleTimeString()}</span>
                        </div>
                        ${messageContent}
                    </div>
                `;
            }).join('');
        
        try {
            messagesContainer.innerHTML = messagesHTML;
            this.scrollToBottom();
        } catch (error) {
            console.error('❌ [DISPLAY] Error setting HTML:', error);
        }
    }
    
    // Render file message content
    renderFileMessage(msg) {
        try {
            const isImage = msg.file_type && msg.file_type.startsWith('image/');
            const fileIcon = this.getFileIcon(msg.file_type);
            const fileSize = this.formatFileSize(msg.file_size);
            
            if (isImage) {
                // For images, show preview
                const imageHtml = `
                    <div class="image-message">
                        <img src="${msg.file_url}" alt="${msg.file_name}" 
                             style="max-width: 300px; max-height: 300px; cursor: pointer; border-radius: 8px;"
                             onclick="window.chatManager.openImageModal('${msg.file_url}', '${msg.file_name}')">
                    </div>
                `;
                return imageHtml;
            } else {
                // For other files, show file info with actions
                const fileHtml = `
                    <div class="message-file">
                        <div class="file-message-content">
                            <i class="${fileIcon} file-message-icon"></i>
                            <div class="file-message-details">
                                <div class="file-message-name">${msg.file_name}</div>
                                <div class="file-message-size">${fileSize}</div>
                            </div>
                        </div>
                        <div class="file-message-actions">
                            <a href="${msg.file_url}" target="_blank" class="file-view-btn">
                                <i class="fas fa-eye"></i> View
                            </a>
                            <a href="${msg.file_url}" download="${msg.file_name}" class="file-download-btn">
                                <i class="fas fa-download"></i> Download
                            </a>
                        </div>
                    </div>
                `;
                return fileHtml;
            }
        } catch (error) {
            console.error('❌ Error rendering file message:', error);
            return `<div class="error-message">Error displaying file: ${msg.file_name}</div>`;
        }
    }
    
    // Open image modal for full-size view
    openImageModal(imageUrl, imageName) {
        try {
            // Create modal container
            const modal = document.createElement('div');
            modal.className = 'image-modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                cursor: pointer;
            `;
            
            // Create image element
            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = imageName;
            img.style.cssText = `
                max-width: 90%;
                max-height: 90%;
                object-fit: contain;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            `;
            
            // Add close functionality
            const closeModal = () => {
                document.body.removeChild(modal);
            };
            
            modal.addEventListener('click', closeModal);
            img.addEventListener('click', (e) => e.stopPropagation());
            
            // Add close button
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '&times;';
            closeBtn.style.cssText = `
                position: absolute;
                top: 20px;
                right: 20px;
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                font-size: 30px;
                cursor: pointer;
                border-radius: 50%;
                width: 50px;
                height: 50px;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            closeBtn.addEventListener('click', closeModal);
            
            // Add elements to modal
            modal.appendChild(img);
            modal.appendChild(closeBtn);
            
            // Add to body
            document.body.appendChild(modal);
            
        } catch (error) {
            console.error('❌ Error opening image modal:', error);
            // Fallback: open image in new tab
            window.open(imageUrl, '_blank');
        }
    }
    
    // Show join room prompt (for private rooms)
    joinRoomPrompt(roomId, isPrivate) {
        if (!isPrivate) {
            this.joinRoom(roomId);
            return;
        }
        
        const password = prompt('This is a private room. Please enter the password:');
        if (password) {
            this.joinRoom(roomId, password);
        }
    }
    
    // Handle room search
    handleRoomSearch(e) {
        const searchTerm = e.target.value.toLowerCase();
        const filteredRooms = this.rooms.filter(room => 
            room.name.toLowerCase().includes(searchTerm) ||
            (room.description && room.description.toLowerCase().includes(searchTerm))
        );
        
        this.displayRooms(filteredRooms);
    }
    
    // Show rooms view
    showRoomsView() {
        // If user is currently in a room, leave it properly
        if (this.currentRoom && window.socketClient && window.socketClient.isSocketConnected()) {
            window.socketClient.leaveRoom(this.currentRoom.id);
        }
        
        document.getElementById('chatView').classList.add('hidden');
        document.getElementById('roomsView').classList.remove('hidden');
        this.currentRoom = null;
        
        // Clear messages and reset chat state
        this.messages = [];
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
        }
        
        // Clear typing indicators
        const typingContainer = document.getElementById('typingIndicator');
        if (typingContainer) {
            typingContainer.innerHTML = '';
        }
    }
    
    // Show chat view
    showChatView() {
        document.getElementById('roomsView').classList.add('hidden');
        document.getElementById('chatView').classList.remove('hidden');
    }
    
    // Scroll to bottom of messages
    scrollToBottom() {
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }
    
    // Show success message
    showSuccess(message) {
        if (window.showSuccessModal) {
            window.showSuccessModal(message);
        }
    }
    
    // Show error message
    showError(message) {
        console.error('❌ Chat Error:', message);
        // You can implement a global error notification here
        alert(message); // Temporary fallback
    }
    
    // Get current room
    getCurrentRoom() {
        return this.currentRoom;
    }
    
    // Check if chat is ready
    isReady() {
        return this.isInitialized;
    }
    
    // Transform backend message format to frontend format
    transformBackendMessage(backendMessage) {
        // Backend sends snake_case fields, so we need to handle both formats
        const transformedMessage = {
            id: backendMessage.id,
            room_id: backendMessage.room_id || backendMessage.roomId,
            firebase_uid: backendMessage.firebase_uid,
            message: backendMessage.message,
            message_type: backendMessage.message_type || backendMessage.messageType,
            created_at: backendMessage.created_at || backendMessage.createdAt,
            user: backendMessage.user,
            
            // File fields (handle both snake_case and camelCase)
            file_url: backendMessage.file_url || backendMessage.fileUrl || null,
            file_name: backendMessage.file_name || backendMessage.fileName || null,
            file_type: backendMessage.file_type || backendMessage.fileType || null,
            file_size: backendMessage.file_size || backendMessage.fileSize || null,
            file_public_id: backendMessage.file_public_id || backendMessage.filePublicId || null,
            
            // User display fields
            username: backendMessage.user?.username || 'Unknown',
            display_name: backendMessage.user?.display_name || backendMessage.user?.username || 'Unknown User',
            avatar_url: backendMessage.user?.avatar_url || null
        };
        
        return transformedMessage;
    }
    
    // Validate and clean message data
    validateMessageData(messageData) {
        // Check for required fields in both formats (snake_case and camelCase)
        const hasMessage = !!messageData?.message;
        const hasCreatedAt = !!(messageData?.created_at || messageData?.createdAt);
        
        if (!messageData || !hasMessage || !hasCreatedAt) {
            return null;
        }
        
        // Normalize the message data to ensure consistent format
        const normalizedMessage = {
            ...messageData,
            // Ensure we have the required fields in the expected format
            message: messageData.message,
            created_at: messageData.created_at || messageData.createdAt,
            message_type: messageData.message_type || messageData.messageType,
            room_id: messageData.room_id || messageData.roomId,
            firebase_uid: messageData.firebase_uid,
            
            // User info
            user: messageData.user || {
                username: messageData.username || 'Unknown',
                display_name: messageData.display_name || messageData.username || 'Unknown User',
                avatar_url: messageData.avatar_url || null
            },
            
            // File fields (handle both formats)
            file_url: messageData.file_url || messageData.fileUrl || null,
            file_name: messageData.file_name || messageData.fileName || null,
            file_type: messageData.file_type || messageData.fileType || null,
            file_size: messageData.file_size || messageData.fileSize || null,
            file_public_id: messageData.file_public_id || messageData.filePublicId || null
        };
        
        // Ensure user info is available for display
        const validatedMessage = {
            ...normalizedMessage,
            username: normalizedMessage.user?.username || 'Unknown',
            display_name: normalizedMessage.user?.display_name || normalizedMessage.user?.username || 'Unknown User',
            avatar_url: normalizedMessage.user?.avatar_url || null
        };
        
        return validatedMessage;
    }
    
    // Update room display information
    updateRoomDisplay() {
        if (!this.currentRoom) return;
        
        // Update room name
        const roomNameElement = document.getElementById('currentRoomName');
        if (roomNameElement) {
            roomNameElement.textContent = this.currentRoom.name;
        }
        
        // Update room members count
        const roomMembersElement = document.getElementById('currentRoomMembers');
        if (roomMembersElement) {
            const memberCount = this.currentRoom.members ? this.currentRoom.members.length : 0;
            roomMembersElement.textContent = `${memberCount} members`;
        }
    }
    
    // Refresh messages for current room
    async refreshMessages() {
        if (!this.currentRoom) {
            console.warn('⚠️ No current room to refresh messages for');
            return;
        }
        
        await this.loadMessages(this.currentRoom.id);
    }
    
    // Debug current state
    debugCurrentState() {
        console.log('🔍 Current Chat Manager State:');
        console.log('  - Current Room:', this.currentRoom);
        console.log('  - Messages Count:', this.messages.length);
        console.log('  - Messages:', this.messages);
        console.log('  - Auth Manager:', !!window.authManager);
        console.log('  - User Authenticated:', window.authManager?.isAuthenticated);
        console.log('  - Current User:', window.authManager?.getCurrentUser());
        console.log('  - Socket Client:', !!window.socketClient);
        console.log('  - Socket Connected:', window.socketClient?.isSocketConnected());
    }
    
    // Setup Socket.io event listeners for real-time updates
    setupSocketEventListeners() {
        if (!window.socketClient) {
            console.warn('⚠️ Socket client not available');
            return;
        }
        
        // Unified message handler for both received and sent messages
        const handleIncomingMessage = (data, source = 'received') => {
            
            // Check if message is for current room
            if (parseInt(data.roomId) === parseInt(this.currentRoom?.id)) {
                
                // Transform backend message format to frontend format
                const transformedMessage = this.transformBackendMessage(data.message);
                
                // Process the message
                this.processIncomingMessage(transformedMessage, source);
                
            } else {
                console.log(`⚠️ [${source.toUpperCase()}] Message is for different room`);
                console.log(`📨 [${source.toUpperCase()}] Expected room:`, this.currentRoom?.id);
                console.log(`📨 [${source.toUpperCase()}] Received room:`, data.roomId);
            }
        };
        
        // Listen for new messages
        window.socketClient.on('message_received', (data) => {
            handleIncomingMessage(data, 'received');
        });
        
        // Listen for message sent confirmation
        window.socketClient.on('message_sent', (data) => {
            handleIncomingMessage(data, 'sent');
        });
        
        // Listen for user joined
        window.socketClient.on('user_joined', (data) => {
            if (data.roomId === this.currentRoom?.id) {
                this.showUserNotification(`${data.user.display_name || data.user.username} joined the room`, 'join');
                this.updateRoomDisplay(); // Refresh member count
            }
        });
        
        // Listen for user left
        window.socketClient.on('user_left', (data) => {
            if (data.roomId === this.currentRoom?.id) {
                this.showUserNotification(`${data.user.display_name || data.user.username} left the room`, 'leave');
                this.updateRoomDisplay(); // Refresh member count
            }
        });
        
        // Listen for typing indicators
        window.socketClient.on('typing_indicator', (data) => {
            if (data.roomId === this.currentRoom?.id) {
                this.showTypingIndicator(data.firebase_uid, data.isTyping);
            }
        });
        
        // Listen for connection status
        window.socketClient.on('connected', () => {
            if (this.currentRoom) {
                window.socketClient.joinRoom(this.currentRoom.id);
            }
        });
        
        // Listen for errors
        window.socketClient.on('error', (error) => {
            console.error('❌ Socket error:', error);
            this.showError('Real-time connection error: ' + error.message);
        });
    }
    
    // Add message to display (for real-time updates) - DEPRECATED, use processIncomingMessage instead
    addMessageToDisplay(messageData) {
        this.processIncomingMessage(messageData, 'legacy');
    }
    
    // Check if message is from current user
    isCurrentUserMessage(message) {
        const currentUser = window.authManager?.getCurrentUser();
        return currentUser && currentUser.firebase_uid === message.firebase_uid;
    }
    
    // Unified message processing for both received and sent messages
    processIncomingMessage(messageData, source = 'received') {
        try {
            
            // Check if message already exists to prevent duplicates
            const existingMessage = this.messages.find(msg => msg.id === messageData.id);
            if (existingMessage) {
                return;
            }
            
            // Validate message data
            const validatedMessage = this.validateMessageData(messageData);
            if (!validatedMessage) {
                return;
            }
            
            // Add message to local array
            this.messages.push(validatedMessage);
            
            // Update display immediately
            this.displayMessages();
            this.scrollToBottom();
            
            // Handle source-specific actions
            if (source === 'sent') {
                // Clear input and update UI for sent messages
                this.clearMessageInput();
                this.updateMessageCount();
                this.hideSendingIndicator();
            }
            
        } catch (error) {
            console.error(`❌ [PROCESS] Error processing ${source} message:`, error);
        }
    }
    
    // Create optimistic message for immediate UI feedback
    createOptimisticMessage(messageText) {
        try {
            const currentUser = window.authManager?.getCurrentUser();
            if (!currentUser || !this.currentRoom) return null;
            
            const optimisticMessage = {
                id: `temp_${Date.now()}_${Math.random()}`,
                room_id: this.currentRoom.id,
                firebase_uid: currentUser.firebase_uid,
                message: messageText,
                message_type: 'text',
                created_at: new Date().toISOString(),
                user: {
                    username: currentUser.username || 'You',
                    display_name: currentUser.display_name || currentUser.username || 'You',
                    avatar_url: currentUser.avatar_url || null
                },
                isOptimistic: true // Flag to identify optimistic messages
            };
            
            return optimisticMessage;
            
        } catch (error) {
            console.error('❌ Error creating optimistic message:', error);
            return null;
        }
    }
    
    // Replace optimistic message with real message
    replaceOptimisticMessage(optimisticMessage, realMessage) {
        try {
            if (!optimisticMessage || !realMessage) return;
            
            const index = this.messages.findIndex(msg => msg.id === optimisticMessage.id);
            if (index !== -1) {
                // Replace optimistic message with real message
                const validatedMessage = this.validateMessageData(realMessage);
                if (validatedMessage) {
                    this.messages[index] = validatedMessage;
                    this.displayMessages();
                }
            }
            
        } catch (error) {
            console.error('❌ Error replacing optimistic message:', error);
        }
    }
    
    // Remove optimistic message (e.g., on error)
    removeOptimisticMessage(optimisticMessage) {
        try {
            if (!optimisticMessage) return;
            
            const index = this.messages.findIndex(msg => msg.id === optimisticMessage.id);
            if (index !== -1) {
                this.messages.splice(index, 1);
                this.displayMessages();
            }
            
        } catch (error) {
            console.error('❌ Error removing optimistic message:', error);
        }
    }
    
    // Check chat view status and messages container availability
    checkChatViewStatus() {
        // Check if we're in the right view
        const chatContainer = document.getElementById('chat-container');
        const roomsContainer = document.getElementById('rooms-container');
        
        if (chatContainer && roomsContainer) {
        }
    }
    
    // Clear message input field
    clearMessageInput() {
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.value = '';
            messageInput.focus();
        }
    }
    
    // Update message count and other UI elements
    updateMessageCount() {
        if (this.currentRoom) {
            // Update room display to show new message count
            this.updateRoomDisplay();
            
            // Update any message count indicators
            const messageCountElement = document.querySelector('.message-count');
            if (messageCountElement) {
                messageCountElement.textContent = this.messages.length;
            }
        }
    }
    
    // Show sending indicator
    showSendingIndicator() {
        const sendButton = document.querySelector('.send-button, button[type="submit"]');
        if (sendButton) {
            const originalText = sendButton.innerHTML;
            sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
            sendButton.disabled = true;
            sendButton.dataset.originalText = originalText;
        }
    }
    
    // Hide sending indicator
    hideSendingIndicator() {
        const sendButton = document.querySelector('.send-button, button[type="submit"]');
        if (sendButton && sendButton.dataset.originalText) {
            sendButton.innerHTML = sendButton.dataset.originalText;
            sendButton.disabled = false;
            delete sendButton.dataset.originalText;
        }
    }
    
    // Show user notification
    showUserNotification(message, type = 'general') {
        const notification = document.createElement('div');
        notification.className = `user-notification user-notification-${type}`;
        
        // Add appropriate icon based on type
        const icon = type === 'join' ? '👥' : type === 'leave' ? '👋' : 'ℹ️';
        notification.innerHTML = `<span class="notification-icon">${icon}</span> ${message}`;
        
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            messagesContainer.appendChild(notification);
            this.scrollToBottom();
            
            // Remove notification after 5 seconds
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 5000);
        }
    }
    
    // Show typing indicator
    showTypingIndicator(firebase_uid, isTyping) {
        const typingContainer = document.getElementById('typingIndicator');
        if (!typingContainer) {
            // Create typing indicator if it doesn't exist
            const chatMessages = document.querySelector('.chat-messages');
            if (chatMessages) {
                const indicator = document.createElement('div');
                indicator.id = 'typingIndicator';
                indicator.className = 'typing-indicator hidden';
                chatMessages.appendChild(indicator);
            }
        }
        
        if (typingContainer) {
            if (isTyping) {
                typingContainer.textContent = 'Someone is typing...';
                typingContainer.classList.remove('hidden');
            } else {
                typingContainer.classList.add('hidden');
            }
        }
    }
    
}

// Initialize chat manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chatManager = new ChatManager();
});

// Export for global access
window.ChatManager = ChatManager;
