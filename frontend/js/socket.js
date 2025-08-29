/**
 * Socket.io Client Manager for Real-time Chat
 * Handles WebSocket connections, room management, and real-time messaging
 */
class SocketClient {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.currentRoom = null;
        this.typingTimeout = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; 
        
        this.eventHandlers = new Map();
        this.initializeSocket();
    }
    
    /**
     * Initialize socket connection
     */
    initializeSocket() {
        try {
            // Get Firebase token from auth manager
            const token = window.authManager?.getSessionToken();
            if (!token) {
                console.warn('⚠️ No Firebase token available for socket connection');
                return;
            }
            
            // Connect to Socket.io server
            this.socket = io(CONFIG.API_BASE_URL, {
                auth: {
                    token: token
                },
                transports: ['websocket', 'polling'],
                timeout: 20000,
                forceNew: true
            });
            
            this.setupEventListeners();
            this.setupConnectionHandling();
            
        } catch (error) {
            console.error('❌ Socket initialization error:', error);
        }
    }
    
    /**
     * Setup socket event listeners
     */
    setupEventListeners() {
        if (!this.socket) return;
        
        // Connection events
        this.socket.on('connect', () => {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.reconnectDelay = 1000;
            this.updateSocketStatus('connected');
            this.triggerEvent('connected');
        });
        
        this.socket.on('disconnect', (reason) => {
            this.isConnected = false;
            this.updateSocketStatus('disconnected');
            this.triggerEvent('disconnected', { reason });
            
            // Handle reconnection for unexpected disconnections
            if (reason === 'io server disconnect') {
                this.socket.connect();
            }
        });
        
        this.socket.on('connect_error', (error) => {
            this.isConnected = false;
            this.updateSocketStatus('connecting');
            this.triggerEvent('connection_error', { error });
            
            // Check if it's an authentication error
            if (error.message && error.message.includes('Authentication failed')) {
                this.handleAuthenticationFailure();
                return;
            }
            
            // Implement exponential backoff for reconnection
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                setTimeout(() => {
                    this.reconnectAttempts++;
                    this.reconnectDelay *= 2; // Exponential backoff
                    this.socket.connect();
                }, this.reconnectDelay);
            }
        });
        
        // Chat events
        this.socket.on('message_received', (data) => {
            this.triggerEvent('message_received', data);
        });
        
        this.socket.on('message_sent', (data) => {
            this.triggerEvent('message_sent', data);
        });
        
        this.socket.on('user_joined', (data) => {
            this.triggerEvent('user_joined', data);
        });
        
        this.socket.on('user_left', (data) => {
            this.triggerEvent('user_left', data);
        });
        
        this.socket.on('typing_indicator', (data) => {
            this.triggerEvent('typing_indicator', data);
        });
        
        this.socket.on('user_status', (data) => {
            this.triggerEvent('user_status', data);
        });
        
        this.socket.on('room_joined', (data) => {
            this.triggerEvent('room_joined', data);
        });
        
        this.socket.on('room_left', (data) => {
            this.triggerEvent('room_left', data);
        });
        
        // Error handling
        this.socket.on('error', (error) => {
            this.triggerEvent('error', error);
        });
        
        // Handle forced disconnection (when session is invalidated)
        this.socket.on('forced_disconnect', (data) => {
            this.isConnected = false;
            this.updateSocketStatus('disconnected');
            
            // Notify user about forced disconnection
            if (window.authManager) {
                window.authManager.showError('login-error', data.message || 'Your session has been invalidated. Please login again.');
                // Force logout after a short delay
                setTimeout(() => {
                    window.authManager.logout();
                }, 2000);
            }
            
            this.triggerEvent('forced_disconnect', data);
        });
    }
    
    /**
     * Setup connection handling for page visibility changes
     */
    setupConnectionHandling() {
        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Page is hidden, could implement away status
            } else {
                // Page is visible, ensure connection
                if (!this.isConnected) {
                    this.reconnect();
                }
            }
        });
        
        // Handle beforeunload
        window.addEventListener('beforeunload', () => {
            if (this.socket) {
                this.socket.disconnect();
            }
        });
    }
    
    /**
     * Connect to a chat room
     */
    joinRoom(roomId) {
        if (!this.socket || !this.isConnected) {
            console.warn('⚠️ Socket not connected, cannot join room');
            return false;
        }
        
        try {
            this.socket.emit('join_room', { roomId });
            this.currentRoom = roomId;
            return true;
        } catch (error) {
            console.error('❌ Join room error:', error);
            return false;
        }
    }
    
    /**
     * Leave a chat room
     */
    leaveRoom(roomId) {
        if (!this.socket || !this.isConnected) {
            console.warn('⚠️ Socket not connected, cannot leave room');
            return false;
        }
        
        try {
            this.socket.emit('leave_room', { roomId });
            
            if (this.currentRoom === roomId) {
                this.currentRoom = null;
            }
            return true;
        } catch (error) {
            console.error('❌ Leave room error:', error);
            return false;
        }
    }
    
    /**
     * Send a message to the current room
     */
    sendMessage(message, messageType = 'text', fileData = null) {
        if (!this.socket || !this.isConnected) {
            console.warn('⚠️ Socket not connected, cannot send message');
            return false;
        }
        
        if (!this.currentRoom) {
            console.warn('⚠️ No current room, cannot send message');
            return false;
        }
        
        try {
            const messagePayload = {
                roomId: this.currentRoom,
                message: message,
                messageType: messageType
            };
            
            // Add file data if it's a file message
            if (messageType === 'file' && fileData) {
                messagePayload.fileData = fileData;
            }
            
            this.socket.emit('send_message', messagePayload);
            return true;
        } catch (error) {
            console.error('❌ Send message error:', error);
            return false;
        }
    }
    
    /**
     * Start typing indicator
     */
    startTyping() {
        if (!this.socket || !this.isConnected || !this.currentRoom) {
            return false;
        }
        
        try {
            this.socket.emit('typing_start', { roomId: this.currentRoom });
            
            // Clear existing timeout
            if (this.typingTimeout) {
                clearTimeout(this.typingTimeout);
            }
            
            return true;
        } catch (error) {
            console.error('❌ Start typing error:', error);
            return false;
        }
    }
    
    /**
     * Stop typing indicator
     */
    stopTyping() {
        if (!this.socket || !this.isConnected || !this.currentRoom) {
            return false;
        }
        
        try {
            this.socket.emit('typing_stop', { roomId: this.currentRoom });
            
            // Clear timeout
            if (this.typingTimeout) {
                clearTimeout(this.typingTimeout);
                this.typingTimeout = null;
            }
            
            return true;
        } catch (error) {
            console.error('❌ Stop typing error:', error);
            return false;
        }
    }
    
    /**
     * Set typing timeout (auto-stop typing after delay)
     */
    setTypingTimeout(delay = 4000) {
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }
        
        this.typingTimeout = setTimeout(() => {
            this.stopTyping();
        }, delay);
    }
    
    /**
     * Update user status
     */
    updateUserStatus(status) {
        if (!this.socket || !this.isConnected) {
            return false;
        }
        
        try {
            this.socket.emit('user_status', { status });
            return true;
        } catch (error) {
            console.error('❌ Update status error:', error);
            return false;
        }
    }
    
    /**
     * Reconnect to server
     */
    reconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
        
        setTimeout(() => {
            this.initializeSocket();
        }, 1000);
    }
    
    /**
     * Disconnect from server
     */
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.isConnected = false;
        this.currentRoom = null;
    }
    
    /**
     * Event handling system - implement standard socket.io on/off methods
     */
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
        
        // Also set up the actual socket.io event listener if socket is available
        if (this.socket) {
            this.socket.on(event, handler);
        }
    }
    
    /**
     * Remove event handler
     */
    off(event, handler) {
        if (this.eventHandlers.has(event)) {
            const handlers = this.eventHandlers.get(event);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
        
        // Also remove from actual socket if available
        if (this.socket) {
            this.socket.off(event, handler);
        }
    }
    
    /**
     * Trigger custom events for internal event system
     */
    triggerEvent(event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`❌ Event handler error for ${event}:`, error);
                }
            });
        }
    }
    
    /**
     * Get connection status
     */
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            currentRoom: this.currentRoom,
            reconnectAttempts: this.reconnectAttempts
        };
    }
    
    /**
     * Check if connected
     */
    isSocketConnected() {
        return this.isConnected && this.socket && this.socket.connected;
    }
    
    /**
     * Update socket status indicator in UI
     */
    updateSocketStatus(status) {
        const statusElement = document.getElementById('socketStatus');
        if (!statusElement) return;
        
        // Remove all status classes
        statusElement.classList.remove('connected', 'disconnected', 'connecting');
        
        // Add new status class
        statusElement.classList.add(status);
        
        // Update text and icon
        const icon = statusElement.querySelector('i');
        const text = statusElement.textContent.split(' ').slice(1).join(' ');
        
        switch (status) {
            case 'connected':
                icon.className = 'fas fa-wifi';
                statusElement.innerHTML = `<i class="fas fa-wifi"></i> Connected`;
                break;
            case 'disconnected':
                icon.className = 'fas fa-wifi-slash';
                statusElement.innerHTML = `<i class="fas fa-wifi-slash"></i> Disconnected`;
                break;
            case 'connecting':
                icon.className = 'fas fa-sync-alt fa-spin';
                statusElement.innerHTML = `<i class="fas fa-sync-alt fa-spin"></i> Connecting...`;
                break;
        }
    }

    /**
     * Handle authentication failure (e.g., session expired)
     */
    handleAuthenticationFailure() {
        if (window.authManager) {
            window.authManager.showError('login-error', 'Your session has expired. Please login again.');
            window.authManager.logout();
        }
        // Optionally, redirect to login page
        window.location.href = '/login';
    }
}

// Initialize socket client when DOM is loaded
let socketClient = null;

document.addEventListener('DOMContentLoaded', () => {
    // Wait for auth manager to be available
    const initSocket = () => {
        if (window.authManager && window.authManager.isAuthenticated) {
            socketClient = new SocketClient();
            window.socketClient = socketClient;
        } else {
            // Retry after a short delay
            setTimeout(initSocket, 1000);
        }
    };
    
    initSocket();
});

// Export for use in other modules
window.SocketClient = SocketClient;
