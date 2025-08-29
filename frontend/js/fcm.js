// Firebase Cloud Messaging (FCM) Manager
class FCMManager {
    constructor() {
        this.messaging = null;
        this.isSupported = false;
        this.isInitialized = false;
        this.currentToken = null;
        this.notificationPermission = 'default';
        this.notificationHistory = [];
        this.maxNotificationHistory = 10;
        
        this.init();
    }
    
    // Initialize FCM
    async init() {
        try {
            console.log('📱 [INIT] Starting FCM initialization...');
            
            // Check if we're in a service worker context
            if (typeof ServiceWorkerGlobalScope !== 'undefined' && self instanceof ServiceWorkerGlobalScope) {
                console.warn('⚠️ [INIT] FCM Manager should not be initialized in service worker context');
                return;
            }
            
            // Check if Firebase is available
            if (typeof firebase === 'undefined') {
                console.warn('⚠️ [INIT] Firebase not loaded, FCM not available');
                return;
            }
            
            console.log('📱 [INIT] Firebase SDK available');
            
            // Check if messaging is supported
            if (!firebase.messaging.isSupported()) {
                console.warn('⚠️ [INIT] Firebase Messaging not supported in this browser');
                return;
            }
            
            console.log('📱 [INIT] Firebase Messaging supported');
            
            this.isSupported = true;
            
            // Ensure Firebase app is initialized
            if (!firebase.apps.length) {
                console.log('📱 [INIT] Initializing Firebase app...');
                firebase.initializeApp(window.firebaseConfig);
            }
            
            this.messaging = firebase.messaging();
            console.log('📱 [INIT] Firebase Messaging instance created');
            
            // Verify messaging instance
            if (!this.messaging) {
                throw new Error('Failed to create Firebase Messaging instance');
            }
            
            console.log('📱 [INIT] Firebase Messaging instance verified');
            
            // Request notification permission
            console.log('📱 [INIT] Requesting notification permission...');
            const permission = await this.requestPermission();
            console.log('📱 [INIT] Notification permission result:', permission);
            
            if (permission !== 'granted') {
                console.warn('⚠️ [INIT] Notification permission not granted, FCM may not work properly');
            }
            
            // Setup message handling
            console.log('📱 [INIT] Setting up message handling...');
            this.setupMessageHandling();
            
            // Debug messaging object to see available methods
            console.log('📱 [INIT] Messaging object properties:', Object.keys(this.messaging));
            console.log('📱 [INIT] Messaging prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(this.messaging)));
            
            // Wait a bit for Firebase to be fully ready
            console.log('📱 [INIT] Waiting for Firebase to be fully ready...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Get current token
            console.log('📱 [INIT] Getting current FCM token...');
            const token = await this.getCurrentToken();
            
            if (token) {
                console.log('📱 [INIT] FCM token obtained during initialization');
                
                // Start periodic token validation
                this.startTokenValidation();
                
                // Validate token immediately
                setTimeout(async () => {
                    await this.validateCurrentToken();
                }, 3000); // Wait 3 seconds then validate
                
            } else {
                console.warn('⚠️ [INIT] No FCM token obtained during initialization');
                console.log('📱 [INIT] This could be due to:');
                console.log('📱 [INIT] - Service worker not registered');
                console.log('📱 [INIT] - VAPID key issues');
                console.log('📱 [INIT] - Firebase configuration problems');
                console.log('📱 [INIT] - Browser compatibility issues');
                
                // Try to diagnose the issue
                this.diagnoseTokenIssue();
            }
            
            this.isInitialized = true;
            console.log('✅ [INIT] FCM Manager initialized successfully');
            
        } catch (error) {
            console.error('❌ [INIT] FCM initialization failed:', error);
            console.error('📱 [INIT] Error details:', {
                message: error.message,
                name: error.name,
                stack: error.stack?.split('\n')[0]
            });
        }
    }
    
    // Request notification permission
    async requestPermission() {
        try {
            const permission = await Notification.requestPermission();
            this.notificationPermission = permission;
            
            if (permission === 'granted') {
                console.log('✅ Notification permission granted');
            } else if (permission === 'denied') {
                console.warn('⚠️ Notification permission denied');
            } else {
                console.log('ℹ️ Notification permission not determined');
            }
            
            return permission;
            
        } catch (error) {
            console.error('❌ Failed to request notification permission:', error);
            return 'denied';
        }
    }
    
    // Setup message handling
    setupMessageHandling() {
        if (!this.messaging) return;
        
        // Handle foreground messages only (background messages are handled by service worker)
        this.messaging.onMessage((payload) => {
            console.log('📱 Foreground message received:', payload);
            this.handleForegroundMessage(payload);
        });
        
        // Listen for token refresh events (Firebase v10+ compatible)
        try {
            if (typeof this.messaging.onTokenRefresh === 'function') {
                this.messaging.onTokenRefresh(async () => {
                    console.log('📱 [TOKEN_REFRESH] Firebase token refresh event triggered');
                    try {
                        const newToken = await this.messaging.getToken({
                            vapidKey: this.getVapidKey()
                        });
                        
                        if (newToken && newToken !== this.currentToken) {
                            console.log('📱 [TOKEN_REFRESH] New token received, updating backend...');
                            this.currentToken = newToken;
                            await this.updateTokenOnBackend(newToken);
                            console.log('✅ [TOKEN_REFRESH] Token refreshed and backend updated successfully');
                        } else {
                            console.log('📱 [TOKEN_REFRESH] Token unchanged or invalid');
                        }
                    } catch (error) {
                        console.error('❌ [TOKEN_REFRESH] Failed to handle token refresh:', error);
                    }
                });
                console.log('📱 [SETUP] Token refresh listener configured');
            } else {
                console.log('📱 [SETUP] onTokenRefresh not available, using periodic token validation instead');
                // Start periodic token validation as fallback
                this.startTokenValidation();
            }
        } catch (error) {
            console.warn('⚠️ [SETUP] Token refresh listener setup failed, using periodic validation:', error.message);
            this.startTokenValidation();
        }
        
        console.log('📱 [SETUP] Foreground message handling configured');
        console.log('📱 [SETUP] Background messages are handled by service worker');
    }
    
    // Handle foreground messages
    handleForegroundMessage(payload) {
        const { notification, data } = payload;
        
        console.log('📱 [FOREGROUND] Received FCM message:', {
            notification: notification || 'No notification data',
            data: data || 'No data payload',
            timestamp: new Date().toISOString(),
            currentUser: window.authManager?.currentUser?.firebase_uid || 'Not authenticated'
        });
        
        // Check if notification should be shown
        if (!this.shouldShowNotification(data)) {
            return;
        }
        
        // Track notification
        this.trackNotification(notification, data, 'foreground');
        
        if (notification) {
            // Show custom notification
            this.showCustomNotification(notification, data);
        }
        
        // Emit event for other parts of the app
        this.emitMessageEvent('foreground_message', payload);
    }
    
    // Background messages are handled by the service worker
    // This method is not used in the main application context
    handleBackgroundMessage(payload) {
        console.log('📱 [BACKGROUND] Background message received in main context (should be handled by service worker):', payload);
        // Background messages are handled by the service worker
        // We only handle foreground messages here
    }
    
    // Show custom notification (for foreground messages)
    showCustomNotification(notification, data) {
        try {
            console.log('📱 [NOTIFICATION] Showing custom notification:', {
                title: notification.title,
                body: notification.body,
                data: data,
                timestamp: new Date().toISOString()
            });
            
            // Create notification container
            const notificationElement = document.createElement('div');
            notificationElement.className = 'fcm-notification';
            
            // Determine notification type and icon
            const notificationType = data?.type || 'message';
            const icon = this.getNotificationIcon(notificationType);
            const roomName = data?.roomName || data?.roomId || 'Unknown Room';
            const senderName = data?.senderName || 'Someone';
            
            notificationElement.innerHTML = `
                <div class="fcm-notification-content">
                    <div class="fcm-notification-header">
                        <div class="fcm-notification-icon">${icon}</div>
                        <div class="fcm-notification-info">
                            <h4 class="fcm-notification-title">${notification.title || 'New Message'}</h4>
                            <span class="fcm-notification-subtitle">${roomName} • ${senderName}</span>
                        </div>
                        <button class="fcm-notification-close">&times;</button>
                    </div>
                    <div class="fcm-notification-body">
                        <p>${notification.body || 'You have a new message'}</p>
                    </div>
                    <div class="fcm-notification-footer">
                        <span class="fcm-notification-time">${this.formatTime(new Date())}</span>
                        <button class="fcm-notification-action">View</button>
                    </div>
                </div>
            `;
            
            // Add to page
            document.body.appendChild(notificationElement);
            
            // Add entrance animation
            setTimeout(() => {
                notificationElement.classList.add('fcm-notification-show');
            }, 100);
            
            // Add close functionality
            const closeBtn = notificationElement.querySelector('.fcm-notification-close');
            closeBtn.addEventListener('click', () => {
                this.removeNotification(notificationElement);
            });
            
            // Add click handler for the notification
            notificationElement.addEventListener('click', (e) => {
                if (!e.target.classList.contains('fcm-notification-close')) {
                    this.handleNotificationClick(data);
                    this.removeNotification(notificationElement);
                }
            });
            
            // Auto-remove after timeout
            setTimeout(() => {
                this.removeNotification(notificationElement);
            }, CONFIG.NOTIFICATION_TIMEOUT || 5000);
            
            // Add CSS styles if not already present
            this.addNotificationStyles();
            
        } catch (error) {
            console.error('❌ Error showing custom notification:', error);
        }
    }
    
    // Remove notification with animation
    removeNotification(notificationElement) {
        if (notificationElement && notificationElement.parentNode) {
            notificationElement.classList.remove('fcm-notification-show');
            setTimeout(() => {
                if (notificationElement.parentNode) {
                    notificationElement.remove();
                }
            }, 300);
        }
    }
    
    // Get notification icon based on type
    getNotificationIcon(type) {
        const icons = {
            'chat_message': '💬',
            'file': '📎',
            'image': '🖼️',
            'system': '🔔',
            'default': '📱'
        };
        return icons[type] || icons.default;
    }
    
    // Format time for notification
    formatTime(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return date.toLocaleDateString();
    }
    
    // Show system notification (for background messages)
    showSystemNotification(notification, data) {
        if (this.notificationPermission !== 'granted') return;
        
        console.log('📱 [SYSTEM_NOTIFICATION] Showing system notification:', {
            title: notification.title,
            body: notification.body,
            data: data,
            timestamp: new Date().toISOString()
        });
        
        // Check if notification should be shown
        if (!this.shouldShowNotification(data)) {
            return;
        }
        
        // Track notification
        this.trackNotification(notification, data, 'system');
        
        const options = {
            body: notification.body,
            icon: notification.icon || '/favicon.ico',
            badge: '/favicon.ico',
            tag: 'chat-notification',
            data: data || {},
            requireInteraction: true,
            actions: [
                {
                    action: 'open',
                    title: 'Open Chat'
                },
                {
                    action: 'dismiss',
                    title: 'Dismiss'
                }
            ]
        };
        
        const systemNotification = new Notification(notification.title, options);
        
        // Handle notification click
        systemNotification.onclick = (event) => {
            event.preventDefault();
            console.log('📱 [SYSTEM_NOTIFICATION] System notification clicked:', event.action);
            
            // Handle different actions
            if (event.action === 'open' || !event.action) {
                this.handleNotificationClick(data);
            }
            
            systemNotification.close();
        };
        
        // Handle notification close
        systemNotification.onclose = () => {
            console.log('📱 [SYSTEM_NOTIFICATION] System notification closed');
        };
        
        // Auto-close after 10 seconds
        setTimeout(() => {
            systemNotification.close();
        }, 10000);
    }
    
    // Handle notification click
    handleNotificationClick(data) {
        console.log('📱 [NOTIFICATION_CLICK] Notification clicked:', {
            data: data,
            timestamp: new Date().toISOString(),
            currentUser: window.authManager?.currentUser?.firebase_uid || 'Not authenticated'
        });
        
        // Focus the window
        window.focus();
        
        // If it's a chat message, navigate to the room
        if (data && data.type === 'chat_message' && data.roomId) {
            console.log('📱 [NOTIFICATION_CLICK] Navigating to room:', data.roomId);
            this.navigateToRoom(data.roomId);
        } else {
            console.log('📱 [NOTIFICATION_CLICK] No room navigation - invalid data:', data);
        }
        
        // Emit event for other parts of the app
        this.emitMessageEvent('notification_clicked', data);
    }
    
    // Navigate to chat room
    navigateToRoom(roomId) {
        try {
            // Check if chat manager is available
            if (window.chatManager && typeof window.chatManager.enterRoom === 'function') {
                window.chatManager.enterRoom(roomId);
            } else {
                // Fallback: show rooms view
                if (window.showRoomsView) {
                    window.showRoomsView();
                }
            }
        } catch (error) {
            console.error('❌ Failed to navigate to room:', error);
        }
    }
    
    // Get current FCM token
    async getCurrentToken() {
        try {
            if (!this.messaging) {
                throw new Error('FCM not initialized');
            }
            
            console.log('📱 [GET_TOKEN] Requesting FCM token...');
            
            // Get VAPID key
            let vapidKey;
            try {
                vapidKey = this.getVapidKey();
                console.log('📱 [GET_TOKEN] VAPID key obtained successfully');
            } catch (vapidError) {
                console.error('❌ [GET_TOKEN] Failed to get VAPID key:', vapidError);
                throw new Error(`VAPID key error: ${vapidError.message}`);
            }
            
            console.log('📱 [GET_TOKEN] Requesting token from Firebase...');
            const token = await this.messaging.getToken({
                vapidKey: vapidKey
            });
            
            if (token) {
                this.currentToken = token;
                console.log('✅ [GET_TOKEN] FCM token obtained successfully');
                console.log('📱 [GET_TOKEN] Token length:', token.length);
                console.log('📱 [GET_TOKEN] Token preview:', token.substring(0, 20) + '...');
                
                // Send token to backend
                console.log('📱 [GET_TOKEN] Sending token to backend...');
                const backendUpdate = await this.updateTokenOnBackend(token);
                
                if (backendUpdate) {
                    console.log('✅ [GET_TOKEN] Token successfully sent to backend');
                } else {
                    console.warn('⚠️ [GET_TOKEN] Failed to send token to backend');
                }
                
                return token;
            } else {
                console.warn('⚠️ [GET_TOKEN] No FCM token available from Firebase');
                return null;
            }
            
        } catch (error) {
            console.error('❌ [GET_TOKEN] Failed to get FCM token:', error);
            console.error('📱 [GET_TOKEN] Error details:', {
                message: error.message,
                name: error.name,
                code: error.code,
                stack: error.stack?.split('\n')[0]
            });
            
            // Provide more specific error information
            if (error.message.includes('VAPID key')) {
                console.error('📱 [GET_TOKEN] VAPID key configuration issue detected');
            } else if (error.message.includes('permission')) {
                console.error('📱 [GET_TOKEN] Permission issue detected');
            } else if (error.message.includes('service worker')) {
                console.error('📱 [GET_TOKEN] Service worker issue detected');
            }
            
            return null;
        }
    }
    
    // Get VAPID key from environment or config
    getVapidKey() {
        const vapidKey = CONFIG.FCM_VAPID_KEY;
        
        if (!vapidKey || vapidKey === 'YOUR_VAPID_KEY_HERE') {
            console.error('❌ [VAPID_KEY] Invalid VAPID key configured. Please update CONFIG.FCM_VAPID_KEY with your actual VAPID key from Firebase Console.');
            throw new Error('Invalid VAPID key configuration');
        }
        
        console.log('📱 [VAPID_KEY] Raw VAPID key:', vapidKey);
        
        // For Firebase Messaging, we should pass the VAPID key as a string
        // Firebase will handle the conversion internally
        console.log('📱 [VAPID_KEY] Using VAPID key as string (Firebase will convert internally)');
        return vapidKey;
    }
    
    // Update token on backend
    async updateTokenOnBackend(token) {
        try {
            // Check if user is authenticated
            if (!window.authManager || !window.authManager.isAuthenticated) {
                console.log('ℹ️ User not authenticated, skipping token update');
                return;
            }
            
            const authToken = window.authManager.getSessionToken();
            if (!authToken) {
                console.warn('⚠️ No auth token available for FCM token update');
                return;
            }
            
            const response = await fetch(getApiUrl('/api/auth/notifications/fcm-token'), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ fcm_token: token })
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ FCM token updated on backend:', data.message);
            } else {
                console.warn('⚠️ Failed to update FCM token on backend');
            }
            
        } catch (error) {
            console.error('❌ Error updating FCM token on backend:', error);
        }
    }
    
    // Refresh FCM token
    async refreshToken() {
        try {
            if (!this.messaging) return null;
            
            const token = await this.messaging.getToken({
                vapidKey: this.getVapidKey(),
                forceRefresh: true
            });
            
            if (token && token !== this.currentToken) {
                this.currentToken = token;
                await this.updateTokenOnBackend(token);
                console.log('✅ FCM token refreshed');
            }
            
            return token;
            
        } catch (error) {
            console.error('❌ Failed to refresh FCM token:', error);
            return null;
        }
    }
    
    // Force refresh token (alternative to onTokenRefresh)
    async forceRefreshToken() {
        try {
            console.log('📱 [FORCE_REFRESH] Force refreshing FCM token...');
            
            if (!this.messaging) {
                console.warn('⚠️ [FORCE_REFRESH] Firebase Messaging not initialized');
                return null;
            }
            
            // Force delete current token to get a new one
            try {
                if (this.currentToken) {
                    await this.messaging.deleteToken();
                    console.log('📱 [FORCE_REFRESH] Current token deleted');
                }
            } catch (deleteError) {
                console.warn('⚠️ [FORCE_REFRESH] Failed to delete current token:', deleteError.message);
            }
            
            // Get new token
            const newToken = await this.messaging.getToken({
                vapidKey: this.getVapidKey()
            });
            
            if (newToken) {
                console.log('📱 [FORCE_REFRESH] New token received:', newToken.substring(0, 20) + '...');
                this.currentToken = newToken;
                
                // Update backend
                await this.updateTokenOnBackend(newToken);
                console.log('✅ [FORCE_REFRESH] Token refreshed and backend updated');
                
                return newToken;
            } else {
                console.warn('⚠️ [FORCE_REFRESH] No new token received');
                return null;
            }
        } catch (error) {
            console.error('❌ [FORCE_REFRESH] Failed to force refresh FCM token:', error);
            return null;
        }
    }
    
    // Diagnose token generation issues
    async diagnoseTokenIssue() {
        console.log('🔍 [DIAGNOSE] Starting FCM token issue diagnosis...');
        
        try {
            // Check service worker
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.getRegistration();
                if (registration) {
                    console.log('✅ [DIAGNOSE] Service Worker registered:', registration.scope);
                    console.log('📱 [DIAGNOSE] Service Worker state:', registration.active ? 'active' : 'inactive');
                } else {
                    console.log('❌ [DIAGNOSE] No Service Worker registered');
                }
            } else {
                console.log('❌ [DIAGNOSE] Service Worker API not available');
            }
            
            // Check VAPID key
            try {
                const vapidKey = this.getVapidKey();
                console.log('✅ [DIAGNOSE] VAPID key available:', vapidKey.substring(0, 20) + '...');
            } catch (vapidError) {
                console.error('❌ [DIAGNOSE] VAPID key error:', vapidError.message);
            }
            
            // Check Firebase configuration
            if (window.firebaseConfig) {
                console.log('✅ [DIAGNOSE] Firebase config available');
                console.log('📱 [DIAGNOSE] Project ID:', window.firebaseConfig.projectId);
            } else {
                console.log('❌ [DIAGNOSE] Firebase config not available');
            }
            
            // Check messaging instance
            if (this.messaging) {
                console.log('✅ [DIAGNOSE] Firebase Messaging instance available');
                console.log('📱 [DIAGNOSE] Available methods:', Object.getOwnPropertyNames(this.messaging));
            } else {
                console.log('❌ [DIAGNOSE] Firebase Messaging instance not available');
            }
            
            // Check notification permission
            if (Notification.permission === 'granted') {
                console.log('✅ [DIAGNOSE] Notification permission granted');
            } else {
                console.log('❌ [DIAGNOSE] Notification permission:', Notification.permission);
            }
            
            console.log('🔍 [DIAGNOSE] Diagnosis complete');
            
        } catch (error) {
            console.error('❌ [DIAGNOSE] Diagnosis failed:', error);
        }
    }
    
    // Update notification preferences
    async updatePreferences(enabled) {
        try {
            if (!window.authManager || !window.authManager.isAuthenticated) {
                throw new Error('User not authenticated');
            }
            
            const authToken = window.authManager.getSessionToken();
            if (!authToken) {
                throw new Error('No auth token available');
            }
            
            const response = await fetch(getApiUrl('/api/auth/notifications/preferences'), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ enabled: enabled })
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Notification preferences updated:', data.message);
                return true;
            } else {
                throw new Error('Failed to update preferences');
            }
            
        } catch (error) {
            console.error('❌ Failed to update notification preferences:', error);
            return false;
        }
    }
    
    // Get notification status
    async getStatus() {
        try {
            if (!window.authManager || !window.authManager.isAuthenticated) {
                return null;
            }
            
            const authToken = window.authManager.getSessionToken();
            if (!authToken) {
                return null;
            }
            
            const response = await fetch(getApiUrl('/api/auth/notifications/status'), {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.status;
            } else {
                return null;
            }
            
        } catch (error) {
            console.error('❌ Failed to get notification status:', error);
            return null;
        }
    }
    
    // Test notification
    async testNotification(title = 'Test Notification', body = 'This is a test push notification') {
        try {
            if (!window.authManager || !window.authManager.isAuthenticated) {
                throw new Error('User not authenticated');
            }
            
            const authToken = window.authManager.getSessionToken();
            if (!authToken) {
                throw new Error('No auth token available');
            }
            
            const response = await fetch(getApiUrl('/api/auth/notifications/test'), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ title, body })
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Test notification sent:', data.message);
                return true;
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to send test notification');
            }
            
        } catch (error) {
            console.error('❌ Failed to send test notification:', error);
            return false;
        }
    }
    
    // Add notification styles
    addNotificationStyles() {
        if (document.getElementById('fcm-notification-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'fcm-notification-styles';
        style.textContent = `
            .fcm-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                width: 380px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                transform: translateX(400px);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                overflow: hidden;
                color: white;
            }
            
            .fcm-notification-show {
                transform: translateX(0);
            }
            
            .fcm-notification-content {
                padding: 20px;
            }
            
            .fcm-notification-header {
                display: flex;
                align-items: flex-start;
                margin-bottom: 16px;
                gap: 12px;
            }
            
            .fcm-notification-icon {
                font-size: 24px;
                flex-shrink: 0;
                margin-top: 2px;
            }
            
            .fcm-notification-info {
                flex: 1;
                min-width: 0;
            }
            
            .fcm-notification-title {
                margin: 0 0 4px 0;
                font-size: 16px;
                font-weight: 600;
                color: white;
                line-height: 1.3;
            }
            
            .fcm-notification-subtitle {
                font-size: 13px;
                color: rgba(255,255,255,0.8);
                line-height: 1.3;
            }
            
            .fcm-notification-close {
                background: rgba(255,255,255,0.2);
                border: none;
                font-size: 18px;
                color: white;
                cursor: pointer;
                padding: 4px;
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                flex-shrink: 0;
                transition: all 0.2s ease;
            }
            
            .fcm-notification-close:hover {
                background: rgba(255,255,255,0.3);
                transform: scale(1.1);
            }
            
            .fcm-notification-body {
                margin-bottom: 16px;
            }
            
            .fcm-notification-body p {
                margin: 0;
                color: rgba(255,255,255,0.9);
                line-height: 1.4;
                font-size: 14px;
            }
            
            .fcm-notification-footer {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding-top: 12px;
                border-top: 1px solid rgba(255,255,255,0.2);
            }
            
            .fcm-notification-time {
                font-size: 12px;
                color: rgba(255,255,255,0.7);
            }
            
            .fcm-notification-action {
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                padding: 6px 16px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .fcm-notification-action:hover {
                background: rgba(255,255,255,0.3);
                transform: translateY(-1px);
            }
            
            /* Animation for entrance */
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            .fcm-notification-show {
                animation: slideInRight 0.3s ease-out;
            }
        `;
        
        document.head.appendChild(style);
    }
    
    // Event handling system
    emitMessageEvent(event, data) {
        // Create custom event
        const customEvent = new CustomEvent('fcm_message', {
            detail: { event, data }
        });
        
        // Dispatch event
        document.dispatchEvent(customEvent);
        
        // Also trigger on window for global access
        if (window.fcmEvents) {
            window.fcmEvents.trigger(event, data);
        }
    }
    
    // Check if FCM is available
    isAvailable() {
        return this.isSupported && this.isInitialized;
    }
    
    // Start periodic token validation
    startTokenValidation() {
        if (this.tokenValidationInterval) {
            clearInterval(this.tokenValidationInterval);
        }
        
        // Check token validity every 5 minutes
        this.tokenValidationInterval = setInterval(async () => {
            await this.validateCurrentToken();
        }, 5 * 60 * 1000); // 5 minutes
        
        console.log('📱 [TOKEN_VALIDATION] Started periodic token validation (every 5 minutes)');
    }
    
    // Stop periodic token validation
    stopTokenValidation() {
        if (this.tokenValidationInterval) {
            clearInterval(this.tokenValidationInterval);
            this.tokenValidationInterval = null;
            console.log('📱 [TOKEN_VALIDATION] Stopped periodic token validation');
        }
    }
    
    // Validate current token
    async validateCurrentToken() {
        if (!this.currentToken) {
            console.log('📱 [TOKEN_VALIDATION] No current token to validate');
            return false;
        }
        
        try {
            console.log('📱 [TOKEN_VALIDATION] Validating current token...');
            
            // Get fresh token from Firebase
            const freshToken = await this.messaging.getToken({
                vapidKey: this.getVapidKey()
            });
            
            if (!freshToken) {
                console.warn('⚠️ [TOKEN_VALIDATION] Failed to get fresh token from Firebase');
                return false;
            }
            
            if (freshToken !== this.currentToken) {
                console.log('📱 [TOKEN_VALIDATION] Token changed, updating...');
                this.currentToken = freshToken;
                await this.updateTokenOnBackend(freshToken);
                console.log('✅ [TOKEN_VALIDATION] Token updated successfully');
                return true;
            } else {
                console.log('📱 [TOKEN_VALIDATION] Token is still valid');
                return true;
            }
            
        } catch (error) {
            console.error('❌ [TOKEN_VALIDATION] Token validation failed:', error);
            return false;
        }
    }
    
    // Check if current user is the sender of a notification
    isCurrentUserSender(data) {
        if (!data || !data.senderId) return false;
        const currentUserId = window.authManager?.currentUser?.firebase_uid;
        return currentUserId === data.senderId;
    }
    
    // Check if notification should be shown to current user
    shouldShowNotification(data) {
        // Don't show notifications from current user
        if (this.isCurrentUserSender(data)) {
            console.log('📱 [NOTIFICATION_CHECK] Skipping notification - sender is current user');
            return false;
        }
        
        // Check if user is authenticated
        if (!window.authManager?.isAuthenticated) {
            console.log('📱 [NOTIFICATION_CHECK] Skipping notification - user not authenticated');
            return false;
        }
        
        // Don't show notifications if user is currently chatting in the same room
        if (this.isUserInCurrentRoom(data)) {
            console.log('📱 [NOTIFICATION_CHECK] Skipping notification - user is currently chatting in the same room');
            return false;
        }
        
        return true;
    }
    
    // Check if user is currently chatting in the room where the message was sent
    isUserInCurrentRoom(data) {
        try {
            // Check if chat manager is available
            if (!window.chatManager) {
                console.log('📱 [ROOM_CHECK] Chat manager not available');
                return false;
            }
            
            // Check if user is in a chat room
            if (!window.chatManager.currentRoom) {
                console.log('📱 [ROOM_CHECK] User not in any chat room');
                return false;
            }
            
            // Get room ID from notification data
            const notificationRoomId = data?.roomId || data?.room_id;
            if (!notificationRoomId) {
                console.log('📱 [ROOM_CHECK] No room ID in notification data');
                return false;
            }
            
            // Get current room ID
            const currentRoomId = window.chatManager.currentRoom.id;
            
            // Check if room IDs match
            const isSameRoom = parseInt(notificationRoomId) === parseInt(currentRoomId);
            
            // Check if user is actively viewing the chat (not just in rooms list)
            const chatContainer = document.getElementById('chat-container');
            const roomsContainer = document.getElementById('rooms-container');
            const isActivelyChatting = chatContainer && roomsContainer && 
                !chatContainer.classList.contains('hidden') && 
                roomsContainer.classList.contains('hidden');
            
            console.log('📱 [ROOM_CHECK] Room and activity check:', {
                notificationRoomId: notificationRoomId,
                currentRoomId: currentRoomId,
                isSameRoom: isSameRoom,
                currentRoomName: window.chatManager.currentRoom.name,
                isActivelyChatting: isActivelyChatting,
                chatViewActive: chatContainer ? !chatContainer.classList.contains('hidden') : 'unknown',
                roomsViewHidden: roomsContainer ? roomsContainer.classList.contains('hidden') : 'unknown'
            });
            
            // Only skip notification if user is in the SAME room AND actively chatting
            return isSameRoom && isActivelyChatting;
            
        } catch (error) {
            console.error('❌ [ROOM_CHECK] Error checking room status:', error);
            return false;
        }
    }
    
    // Get current token
    getToken() {
        return this.currentToken;
    }
    
    // Get permission status
    getPermissionStatus() {
        return this.notificationPermission;
    }
    
    // Manually refresh FCM token
    async refreshToken() {
        try {
            console.log('📱 [REFRESH] Manually refreshing FCM token...');
            const token = await this.getCurrentToken();
            if (token) {
                console.log('✅ [REFRESH] FCM token refreshed successfully');
                return token;
            } else {
                console.warn('⚠️ [REFRESH] Failed to refresh FCM token');
                return null;
            }
        } catch (error) {
            console.error('❌ [REFRESH] Error refreshing FCM token:', error);
            return null;
        }
    }
    
    // Get detailed status
    getStatus() {
        return {
            isSupported: this.isSupported,
            isInitialized: this.isInitialized,
            isAvailable: this.isAvailable(),
            hasToken: !!this.currentToken,
            tokenLength: this.currentToken ? this.currentToken.length : 0,
            permission: this.notificationPermission,
            firebaseLoaded: typeof firebase !== 'undefined',
            messagingSupported: typeof firebase !== 'undefined' ? firebase.messaging.isSupported() : false,
            chatManagerAvailable: !!window.chatManager,
            currentRoom: window.chatManager?.currentRoom || null,
            chatViewActive: this.isChatViewActive()
        };
    }
    
    // Check if chat view is currently active
    isChatViewActive() {
        try {
            const chatContainer = document.getElementById('chat-container');
            const roomsContainer = document.getElementById('rooms-container');
            
            if (chatContainer && roomsContainer) {
                const isChatViewActive = !chatContainer.classList.contains('hidden');
                const isRoomsViewHidden = roomsContainer.classList.contains('hidden');
                return isChatViewActive && isRoomsViewHidden;
            }
            
            return false;
        } catch (error) {
            console.error('❌ [CHAT_VIEW_CHECK] Error checking chat view status:', error);
            return false;
        }
    }
    
    // Debug current state
    debug() {
        console.log('📱 [DEBUG] FCM Manager Status:', this.getStatus());
        console.log('📱 [DEBUG] Current token:', this.currentToken ? this.currentToken.substring(0, 20) + '...' : 'null');
        console.log('📱 [DEBUG] Firebase config:', window.firebaseConfig);
        console.log('📱 [DEBUG] Raw VAPID key:', CONFIG.FCM_VAPID_KEY ? CONFIG.FCM_VAPID_KEY.substring(0, 20) + '...' : 'not configured');
        
        // Test VAPID key
        try {
            const vapidKey = this.getVapidKey();
            console.log('📱 [DEBUG] VAPID key type:', typeof vapidKey);
            console.log('📱 [DEBUG] VAPID key length:', vapidKey.length);
            console.log('📱 [DEBUG] VAPID key preview:', vapidKey.substring(0, 20) + '...');
        } catch (error) {
            console.error('📱 [DEBUG] VAPID key retrieval failed:', error);
        }
        
        // Check service worker registration
        this.checkServiceWorkerStatus();
        
        // Log notification history if available
        this.logNotificationHistory();
    }
    
    // Log notification history for debugging
    logNotificationHistory() {
        if (this.notificationHistory && this.notificationHistory.length > 0) {
            console.log('📱 [DEBUG] Recent notifications:', this.notificationHistory);
        } else {
            console.log('📱 [DEBUG] No notification history available');
        }
    }
    
    // Track notification for history
    trackNotification(notification, data, type = 'received') {
        const notificationRecord = {
            id: Date.now(),
            type: type,
            notification: notification,
            data: data,
            timestamp: new Date().toISOString(),
            currentUser: window.authManager?.currentUser?.firebase_uid || 'Not authenticated'
        };
        
        // Add to history
        this.notificationHistory.unshift(notificationRecord);
        
        // Keep only recent notifications
        if (this.notificationHistory.length > this.maxNotificationHistory) {
            this.notificationHistory = this.notificationHistory.slice(0, this.maxNotificationHistory);
        }
        
        console.log('📱 [TRACKING] Notification tracked:', notificationRecord);
    }
    
    // Check service worker status
    async checkServiceWorkerStatus() {
        try {
            if ('serviceWorker' in navigator) {
                console.log('📱 [SW_CHECK] Service Worker API available');
                
                const registration = await navigator.serviceWorker.getRegistration();
                if (registration) {
                    console.log('📱 [SW_CHECK] Service Worker registered:', registration.scope);
                    console.log('📱 [SW_CHECK] Service Worker state:', registration.active ? 'active' : 'inactive');
                    
                    if (registration.active) {
                        console.log('📱 [SW_CHECK] Service Worker is active and ready');
                    } else {
                        console.warn('⚠️ [SW_CHECK] Service Worker is not active');
                    }
                } else {
                    console.warn('⚠️ [SW_CHECK] No Service Worker registered');
                    console.log('📱 [SW_CHECK] Attempting to register service worker...');
                    await this.registerServiceWorker();
                }
            } else {
                console.warn('⚠️ [SW_CHECK] Service Worker API not available');
            }
        } catch (error) {
            console.error('❌ [SW_CHECK] Error checking service worker:', error);
        }
    }
    
    // Register service worker
    async registerServiceWorker() {
        try {
            console.log('📱 [SW_REGISTER] Registering Firebase messaging service worker...');
            
            const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
                scope: '/'
            });
            
            console.log('✅ [SW_REGISTER] Service Worker registered successfully:', registration.scope);
            
            // Wait for the service worker to be ready
            await navigator.serviceWorker.ready;
            console.log('✅ [SW_REGISTER] Service Worker is ready');
            
            return registration;
            
        } catch (error) {
            console.error('❌ [SW_REGISTER] Failed to register service worker:', error);
            return null;
        }
    }
}

// Initialize FCM manager when DOM is loaded
let fcmManager = null;

document.addEventListener('DOMContentLoaded', () => {
    // Wait for Firebase to be loaded and user to be authenticated
    const initFCM = () => {
        if (typeof firebase !== 'undefined' && firebase.messaging) {
            console.log('📱 Firebase SDK loaded, waiting for user authentication...');
            
            // Check if user is already authenticated
            if (window.authManager && window.authManager.isAuthenticated) {
                console.log('📱 User already authenticated, initializing FCM...');
                fcmManager = new FCMManager();
                window.fcmManager = fcmManager;
                console.log('✅ FCM Manager initialized for authenticated user');
            } else {
                console.log('📱 User not authenticated yet, waiting...');
                // Retry after a short delay
                setTimeout(initFCM, 1000);
            }
        } else {
            console.log('📱 Firebase SDK not loaded yet, retrying...');
            // Retry after a short delay
            setTimeout(initFCM, 1000);
        }
    };
    
    initFCM();
});

// Also listen for authentication events
document.addEventListener('DOMContentLoaded', () => {
    // Listen for authentication success
    const checkAuthAndInitFCM = () => {
        if (window.authManager && window.authManager.isAuthenticated && !fcmManager) {
            console.log('📱 User authenticated, initializing FCM...');
            fcmManager = new FCMManager();
            window.fcmManager = fcmManager;
            console.log('✅ FCM Manager initialized after authentication');
        }
    };
    
    // Check periodically for authentication
    const authCheckInterval = setInterval(() => {
        if (window.authManager && window.authManager.isAuthenticated) {
            clearInterval(authCheckInterval);
            checkAuthAndInitFCM();
        }
    }, 1000);
    
    // Also check when auth manager becomes available
    const checkAuthManager = () => {
        if (window.authManager) {
            clearInterval(authCheckInterval);
            if (window.authManager.isAuthenticated) {
                checkAuthAndInitFCM();
            }
        }
    };
    
    // Check for auth manager availability
    const authManagerCheck = setInterval(() => {
        if (window.authManager) {
            clearInterval(authManagerCheck);
            checkAuthManager();
        }
    }, 500);
});

// Export for use in other modules
window.FCMManager = FCMManager;

// Global functions for testing and debugging
window.refreshFCMToken = () => {
    if (window.fcmManager) {
        return window.fcmManager.refreshToken();
    } else {
        console.error('❌ FCM Manager not available');
        return null;
    }
};

window.debugFCM = () => {
    if (window.fcmManager) {
        window.fcmManager.debug();
    } else {
        console.error('❌ FCM Manager not available');
    }
};

window.getFCMStatus = () => {
    if (window.fcmManager) {
        return window.fcmManager.getStatus();
    } else {
        return { error: 'FCM Manager not available' };
    }
};

window.registerServiceWorker = async () => {
    if (window.fcmManager) {
        return await window.fcmManager.registerServiceWorker();
    } else {
        console.error('❌ FCM Manager not available');
        return null;
    }
};

window.checkServiceWorker = async () => {
    if (window.fcmManager) {
        return await window.fcmManager.checkServiceWorkerStatus();
    } else {
        console.error('❌ FCM Manager not available');
        return null;
    }
};

window.getNotificationHistory = () => {
    if (window.fcmManager) {
        return window.fcmManager.notificationHistory;
    } else {
        console.error('❌ FCM Manager not available');
        return null;
    }
};

window.clearNotificationHistory = () => {
    if (window.fcmManager) {
        window.fcmManager.notificationHistory = [];
        console.log('📱 Notification history cleared');
        return true;
    } else {
        console.error('❌ FCM Manager not available');
        return false;
    }
};

window.testLocalNotification = () => {
    if (window.fcmManager) {
        const testNotification = {
            title: 'Test Notification',
            body: 'This is a test notification to verify the design and functionality.'
        };
        
        const testData = {
            type: 'chat_message',
            roomId: '999',
            roomName: 'Test Room',
            senderId: 'test_sender_123',
            senderName: 'Test User',
            message: 'Test message content',
            messageType: 'text',
            timestamp: new Date().toISOString()
        };
        
        console.log('🧪 Testing local notification...');
        window.fcmManager.showCustomNotification(testNotification, testData);
        return true;
    } else {
        console.error('❌ FCM Manager not available');
        return false;
    }
};


