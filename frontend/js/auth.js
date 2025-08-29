// Authentication Module
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.sessionToken = null;
        this.isAuthenticated = false;
        
        this.initializeAuth();
        this.bindEvents();
    }
    
    // Initialize authentication state
    initializeAuth() {
        console.log('🔐 Initializing authentication...');
        
        // Check for existing session
        const savedSession = localStorage.getItem(CONFIG.SESSION_STORAGE_KEY);
        if (savedSession) {
            try {
                const session = JSON.parse(savedSession);
                if (session.token && session.user && this.isSessionValid(session)) {
                    this.sessionToken = session.token;
                    this.currentUser = session.user;
                    this.isAuthenticated = true;
                    console.log('✅ Session restored:', this.currentUser.username);
                    
                    // Validate session with backend before proceeding
                    this.validateSessionWithBackend();
                } else {
                    console.log('⏰ Session expired or invalid, redirecting to login');
                    this.clearSession();
                    this.showAuth();
                }
            } catch (error) {
                console.error('❌ Error parsing saved session:', error);
                this.clearSession();
                this.showAuth();
            }
        }
        
        if (!this.isAuthenticated) {
            this.showAuth();
        }
        
        // Set up periodic session validation
        this.setupSessionValidation();
        
        // Set up page visibility handling
        this.setupPageVisibilityHandling();
    }
    
    // Validate session with backend
    async validateSessionWithBackend() {
        try {
            console.log('🔍 Validating session with backend...');
            
            const url = getApiUrl(getEndpoint('SESSION_STATUS'));
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.sessionToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.sessionActive) {
                    console.log('✅ Session validated with backend');
                    
                    // Initialize FCM Manager for restored session
                    console.log('📱 Initializing FCM Manager for restored session...');
                    if (!window.fcmManager) {
                        // Wait a bit for Firebase to be ready, then initialize FCM
                        setTimeout(() => {
                            if (typeof firebase !== 'undefined' && firebase.messaging) {
                                window.fcmManager = new FCMManager();
                                console.log('✅ FCM Manager initialized for restored session');
                            } else {
                                console.warn('⚠️ Firebase not ready for FCM initialization');
                            }
                        }, 1000);
                    } else {
                        console.log('📱 FCM Manager already initialized');
                    }
                    
                    this.showProfile();
                } else {
                    console.log('❌ Session not active on backend');
                    this.handleSessionExpired('Session expired on server');
                }
            } else {
                console.log('❌ Session validation failed:', response.status);
                this.handleSessionExpired('Session validation failed');
            }
            
        } catch (error) {
            console.error('❌ Session validation error:', error);
            this.handleSessionExpired('Network error during session validation');
        }
    }
    
    // Handle expired or invalid sessions
    handleSessionExpired(reason = 'Session expired') {
        console.log('⏰ Session expired:', reason);
        
        // Clear local session
        this.clearSession();
        
        // Disconnect socket if connected
        if (window.socketClient) {
            window.socketClient.disconnect();
        }
        
        // Show appropriate message and redirect to login
        this.showError('login-error', `${reason}. Please login again.`);
        this.showAuth();
        
        // Clear any existing error messages after a delay
        setTimeout(() => {
            this.hideError('login-error');
        }, 5000);
    }
    
    // Bind event listeners
    bindEvents() {
        // Login form submission
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }
        
        // Signup form submission
        const signupForm = document.getElementById('signupForm');
        if (signupForm) {
            signupForm.addEventListener('submit', (e) => this.handleSignup(e));
        }
    }
    
    // Handle login form submission
    async handleLogin(e) {
        e.preventDefault();
        console.log('🔐 Processing login...');
        
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        
        // Validation
        if (!this.validateLoginForm(email, password)) {
            return;
        }
        
        try {
            this.setLoading('loginForm', true);
            this.hideError('login-error');
            
            const response = await this.loginUser(email, password);
            
            if (response.success) {
                this.currentUser = {
                    ...response.user,
                    firebase_uid: response.firebaseUid
                };
                this.sessionToken = response.sessionToken;
                this.isAuthenticated = true;
                
                // Save session
                this.saveSession();
                
                // Check if this was a re-login (session conflict)
                if (response.sessionConflict) {
                    this.showSuccess('Login successful! Previous session has been invalidated. Redirecting...');
                } else {
                    this.showSuccess('Login successful! Redirecting...');
                }
                
                // Initialize chat manager if available
                if (window.chatManager) {
                    console.log('💬 Initializing chat manager for authenticated user...');
                    // Load initial data
                    setTimeout(() => {
                        window.chatManager.loadAllRooms();
                        window.chatManager.loadJoinedRooms();
                    }, 500);
                }
                
                // Initialize FCM Manager for push notifications
                console.log('📱 Initializing FCM Manager for authenticated user...');
                if (!window.fcmManager) {
                    // Wait a bit for Firebase to be ready, then initialize FCM
                    setTimeout(() => {
                        if (typeof firebase !== 'undefined' && firebase.messaging) {
                            window.fcmManager = new FCMManager();
                            console.log('✅ FCM Manager initialized after login');
                            
                            // Force token refresh on new login
                            setTimeout(() => {
                                window.fcmManager.refreshToken().then(newToken => {
                                    if (newToken) {
                                        console.log('📱 [LOGIN] FCM token refreshed for new login');
                                    }
                                });
                            }, 2000);
                        } else {
                            console.warn('⚠️ Firebase not ready for FCM initialization');
                        }
                    }, 1000);
                } else {
                    console.log('📱 FCM Manager already initialized');
                    
                    // Force token refresh on re-login
                    setTimeout(() => {
                        window.fcmManager.refreshToken().then(newToken => {
                            if (newToken) {
                                console.log('📱 [LOGIN] FCM token refreshed for re-login');
                            }
                        });
                    }, 1000);
                }
                
                // Redirect to profile
                setTimeout(() => {
                    this.showProfile();
                }, 1000);
                
            } else {
                this.showError('login-error', response.message || 'Login failed');
            }
            
        } catch (error) {
            console.error('❌ Login error:', error);
            this.showError('login-error', error.message || 'Login failed. Please try again.');
        } finally {
            this.setLoading('loginForm', false);
        }
    }
    
    // Handle signup form submission
    async handleSignup(e) {
        e.preventDefault();
        console.log('🚀 Processing signup...');
        
        const username = document.getElementById('signup-username').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        
        // Validation
        if (!this.validateSignupForm(username, email, password)) {
            return;
        }
        
        try {
            this.setLoading('signupForm', true);
            this.hideError('signup-error');
            
            const response = await this.signupUser(username, email, password);
            
            if (response.success) {
                this.showSuccess('Account created successfully! Please login.');
                
                // Clear form
                document.getElementById('signupForm').reset();
                
                // Switch to login form
                setTimeout(() => {
                    this.showLogin();
                }, 1500);
                
            } else {
                this.showError('signup-error', response.message || 'Signup failed');
            }
            
        } catch (error) {
            console.error('❌ Signup error:', error);
            this.showError('signup-error', error.message || 'Signup failed. Please try again.');
        } finally {
            this.setLoading('signupForm', false);
        }
    }
    
    // API call to login user
    async loginUser(email, password) {
        const url = getApiUrl(getEndpoint('LOGIN'));
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Login failed');
        }
        
        return {
            success: true,
            user: data.user,
            sessionToken: data.sessionToken
        };
    }
    
    // API call to signup user
    async signupUser(username, email, password) {
        const url = getApiUrl(getEndpoint('SIGNUP'));
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Signup failed');
        }
        
        return {
            success: true,
            user: data.user
        };
    }
    
    // Logout user
    async logout() {
        console.log('🚪 Logging out...');
        
        try {
            if (this.sessionToken) {
                // Call logout API
                const url = getApiUrl(getEndpoint('LOGOUT'));
                await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.sessionToken}`,
                        'Content-Type': 'application/json'
                    }
                });
            }
        } catch (error) {
            console.warn('⚠️ Logout API call failed:', error);
        }
        
        // Clear local session
        this.clearSession();
        
        // Clean up session validation interval
        if (this.sessionValidationInterval) {
            clearInterval(this.sessionValidationInterval);
            this.sessionValidationInterval = null;
        }
        
        // Disconnect socket if connected
        if (window.socketClient) {
            window.socketClient.disconnect();
        }
        
        // Show auth forms
        this.showAuth();
        
        console.log('✅ Logged out successfully');
    }
    
    // Force logout all other sessions (security feature)
    async forceLogoutOthers() {
        console.log('🔒 Force logging out other sessions...');
        
        try {
            if (!this.sessionToken) {
                throw new Error('No active session');
            }
            
            const url = getApiUrl('/api/auth/force-logout-others');
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.sessionToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                console.log('✅ Other sessions invalidated:', data.sessionsInvalidated);
                this.showSuccess(`Other sessions invalidated successfully. ${data.sessionsInvalidated} session(s) logged out.`);
                return true;
            } else {
                throw new Error(data.message || 'Failed to invalidate other sessions');
            }
            
        } catch (error) {
            console.error('❌ Force logout others error:', error);
            this.showError('profile-error', error.message || 'Failed to invalidate other sessions');
            return false;
        }
    }
    
    // Handle session conflict (when user logs in elsewhere)
    async handleSessionConflict() {
        console.log('⚠️ Session conflict detected');
        
        try {
            // Check if current session is still valid
            const url = getApiUrl(getEndpoint('SESSION_STATUS'));
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.sessionToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                // Session is invalid, force logout
                console.log('❌ Session is invalid, logging out');
                this.showError('login-error', 'Your session has expired. Please login again.');
                this.logout();
                return;
            }
            
            // Session is still valid, show warning
            this.showError('login-error', 'You have been logged in from another device. Your current session will remain active.');
            
        } catch (error) {
            console.error('❌ Session conflict handling error:', error);
            // If we can't verify session, assume it's invalid
            this.logout();
        }
    }
    
    // Validation methods
    validateLoginForm(email, password) {
        if (!email || !password) {
            this.showError('login-error', 'Please fill in all fields');
            return false;
        }
        
        if (!this.isValidEmail(email)) {
            this.showError('login-error', 'Please enter a valid email address');
            return false;
        }
        
        return true;
    }
    
    validateSignupForm(username, email, password) {
        if (!username || !email || !password) {
            this.showError('signup-error', 'Please fill in all fields');
            return false;
        }
        
        if (username.length < 3 || username.length > CONFIG.MAX_USERNAME_LENGTH) {
            this.showError('signup-error', `Username must be between 3 and ${CONFIG.MAX_USERNAME_LENGTH} characters`);
            return false;
        }
        
        if (!this.isValidEmail(email)) {
            this.showError('signup-error', 'Please enter a valid email address');
            return false;
        }
        
        if (password.length < CONFIG.MIN_PASSWORD_LENGTH) {
            this.showError('signup-error', `Password must be at least ${CONFIG.MIN_PASSWORD_LENGTH} characters`);
            return false;
        }
        
        return true;
    }
    
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    // Session management
    saveSession() {
        const session = {
            token: this.sessionToken,
            user: this.currentUser,
            timestamp: Date.now()
        };
        
        localStorage.setItem(CONFIG.SESSION_STORAGE_KEY, JSON.stringify(session));
        console.log('💾 Session saved to localStorage');
    }
    
    // Restore session from localStorage
    restoreSession() {
        try {
            const sessionData = localStorage.getItem(CONFIG.SESSION_STORAGE_KEY);
            if (!sessionData) return false;
            
            const session = JSON.parse(sessionData);
            
            if (this.isSessionValid(session)) {
                this.sessionToken = session.token;
                this.currentUser = session.user;
                this.isAuthenticated = true;
                
                console.log('🔄 Session restored from localStorage');
                return true;
            } else {
                console.log('⏰ Session expired, clearing...');
                this.clearSession();
                return false;
            }
        } catch (error) {
            console.error('❌ Session restoration failed:', error);
            this.clearSession();
            return false;
        }
    }
    
    // Clear session and cleanup
    clearSession() {
        this.currentUser = null;
        this.sessionToken = null;
        this.isAuthenticated = false;
        
        // Clear validation interval
        if (this.sessionValidationInterval) {
            clearInterval(this.sessionValidationInterval);
            this.sessionValidationInterval = null;
        }
        
        // Stop FCM token validation
        if (window.fcmManager) {
            window.fcmManager.stopTokenValidation();
            console.log('📱 [LOGOUT] FCM token validation stopped');
        }
        
        localStorage.removeItem(CONFIG.SESSION_STORAGE_KEY);
        console.log('🗑️ Session cleared');
    }
    
    isSessionValid(session) {
        if (!session.timestamp) return false;
        
        const now = Date.now();
        const sessionAge = now - session.timestamp;
        
        return sessionAge < CONFIG.SESSION_TIMEOUT;
    }
    
    // UI methods
    showAuth() {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('profile-container').classList.add('hidden');
        document.getElementById('chat-container').classList.add('hidden');
        this.showLogin();
    }
    
    showProfile() {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('profile-container').classList.remove('hidden');
        document.getElementById('chat-container').classList.add('hidden');
        
        // Load profile data
        if (window.profileManager) {
            window.profileManager.loadProfile();
        }
    }
    
    showLogin() {
        document.getElementById('login-form').classList.add('active');
        document.getElementById('signup-form').classList.remove('active');
    }
    
    showSignup() {
        document.getElementById('signup-form').classList.add('active');
        document.getElementById('login-form').classList.remove('active');
    }
    
    setLoading(formId, loading) {
        const form = document.getElementById(formId);
        const button = form.querySelector('button[type="submit"]');
        const btnText = button.querySelector('.btn-text');
        const btnLoader = button.querySelector('.btn-loader');
        
        if (loading) {
            button.classList.add('loading');
            btnText.style.opacity = '0';
            btnLoader.classList.remove('hidden');
        } else {
            button.classList.remove('loading');
            btnText.style.opacity = '1';
            btnLoader.classList.add('hidden');
        }
    }
    
    showError(elementId, message) {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.remove('hidden');
            
            // Auto-hide after duration
            setTimeout(() => {
                this.hideError(elementId);
            }, CONFIG.ERROR_MESSAGE_DURATION);
        }
    }
    
    hideError(elementId) {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.classList.add('hidden');
        }
    }
    
    showSuccess(message) {
        if (window.showSuccessModal) {
            window.showSuccessModal(message);
        }
    }
    
    // Get current user info
    getCurrentUser() {
        return this.currentUser;
    }
    
    // Get session token
    getSessionToken() {
        return this.sessionToken;
    }
    
    // Check if user is authenticated
    checkAuth() {
        return this.isAuthenticated;
    }
    
    // Utility method to check if a response indicates authentication failure
    static isAuthError(response) {
        return response.status === 401 || 
               response.status === 403 ||
               (response.status === 0 && response.type === 'error');
    }
    
    // Utility method to handle authentication errors consistently
    static handleAuthError(response, context = '') {
        console.log(`🔐 Authentication error in ${context}:`, response.status);
        
        if (window.authManager) {
            window.authManager.handleSessionExpired('Authentication failed');
        } else {
            // Fallback if auth manager is not available
            localStorage.removeItem(CONFIG.SESSION_STORAGE_KEY);
            window.location.reload();
        }
    }
    
    // Set up periodic session validation
    setupSessionValidation() {
        // Validate session every 5 minutes
        this.sessionValidationInterval = setInterval(() => {
            if (this.isAuthenticated && this.sessionToken) {
                this.validateSessionSilently();
            }
        }, 5 * 60 * 1000); // 5 minutes
        
        // Also validate when page becomes visible
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.isAuthenticated && this.sessionToken) {
                this.validateSessionSilently();
            }
        });
    }
    
    // Set up page visibility handling
    setupPageVisibilityHandling() {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.isAuthenticated && this.sessionToken) {
                // Page became visible, validate session
                this.validateSessionSilently();
            }
        });
        
        // Handle page focus events
        window.addEventListener('focus', () => {
            if (this.isAuthenticated && this.sessionToken) {
                this.validateSessionSilently();
            }
        });
    }
    
    // Validate session silently (without showing errors)
    async validateSessionSilently() {
        try {
            const url = getApiUrl(getEndpoint('SESSION_STATUS'));
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.sessionToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok || !(await response.json()).sessionActive) {
                console.log('⚠️ Session validation failed silently, redirecting to login');
                this.handleSessionExpired('Session expired');
            }
            
        } catch (error) {
            console.warn('⚠️ Silent session validation failed:', error);
            // Don't redirect on network errors during silent validation
        }
    }
}

// Global functions for HTML onclick handlers
function showLogin() {
    if (window.authManager) {
        window.authManager.showLogin();
    }
}

function showSignup() {
    if (window.authManager) {
        window.authManager.showSignup();
    }
}

function logout() {
    if (window.authManager) {
        window.authManager.logout();
    }
}

function forceLogoutOthers() {
    if (window.authManager) {
        window.authManager.forceLogoutOthers();
    }
}

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const button = input.parentElement.querySelector('.toggle-password i');
    
    if (input.type === 'password') {
        input.type = 'text';
        button.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        button.className = 'fas fa-eye';
    }
}

// Initialize auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
    console.log('✅ Auth manager initialized');
});
