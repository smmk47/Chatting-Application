/**
 * Main Application Module
 * Handles application initialization, global functions, and navigation
 */
class App {
    constructor() {
        this.isInitialized = false;
        this.init();
    }
    
    /**
     * Initialize the application
     */
    async init() {
        try {
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.setupApp());
            } else {
                this.setupApp();
            }
            
        } catch (error) {
            console.error('❌ App initialization failed:', error);
            this.showError('Failed to initialize application');
        }
    }
    
    /**
     * Setup application after DOM is ready
     */
    setupApp() {
        try {
            // Initialize global functions
            this.initializeGlobalFunctions();
            
            // Setup success modal
            this.setupSuccessModal();
            
            // Setup loading screen
            this.setupLoadingScreen();
            
            // Setup form validation
            this.setupFormValidation();
            
            // Setup responsive behavior
            this.setupResponsiveBehavior();
            
            // Setup global authentication error handling
            this.setupGlobalAuthErrorHandling();
            
            // Check authentication status
            this.checkAuthStatus();
            
            // Mark as initialized
            this.isInitialized = true;
            
            // Hide loading screen after a short delay
            setTimeout(() => {
                this.hideLoadingScreen();
            }, 1000);
            
        } catch (error) {
            console.error('❌ App setup failed:', error);
            this.showError('Failed to setup application');
        }
    }
    
    /**
     * Initialize global functions accessible from HTML
     */
    initializeGlobalFunctions() {
        // Success modal functions
        window.showSuccessModal = (message) => this.showSuccessModal(message);
        window.closeModal = () => this.closeSuccessModal();
        
        // Navigation functions
        window.showChatRooms = () => this.showChatRooms();
        window.showProfile = () => this.showProfile();
        window.showCreateRoom = () => this.showCreateRoom();
        window.showRoomsView = () => this.showRoomsView();
        window.switchTab = (tab) => this.switchTab(tab);
        
        // Utility functions
        window.showError = (message) => this.showGlobalError(message);
        window.showSuccess = (message) => this.showGlobalSuccess(message);
    }
    
    /**
     * Setup success modal with event listeners
     */
    setupSuccessModal() {
        const modal = document.getElementById('success-modal');
        if (modal) {
            // Close modal when clicking outside
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeSuccessModal();
                }
            });
            
            // Close modal with Escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                    this.closeSuccessModal();
                }
            });
        }
    }
    
    /**
     * Setup loading screen with fade-out animation
     */
    setupLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.transition = 'opacity 0.5s ease-out';
        }
    }
    
    /**
     * Setup form validation for signup and login forms
     */
    setupFormValidation() {
        // Real-time validation for signup form
        const signupForm = document.getElementById('signup-form');
        if (signupForm) {
            this.setupRealTimeValidation(signupForm);
        }
        
        // Real-time validation for login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            this.setupRealTimeValidation(loginForm);
        }
    }
    
    /**
     * Setup real-time form validation for input fields
     */
    setupRealTimeValidation(form) {
        const inputs = form.querySelectorAll('input, textarea');
        
        inputs.forEach(input => {
            input.addEventListener('blur', () => this.validateField(input));
            input.addEventListener('input', () => this.clearFieldError(input));
        });
    }
    
    /**
     * Validate individual form field
     */
    validateField(field) {
        const value = field.value.trim();
        let isValid = true;
        let errorMessage = '';
        
        // Required field validation
        if (field.hasAttribute('required') && !value) {
            isValid = false;
            errorMessage = 'This field is required';
        }
        
        // Email validation
        if (field.type === 'email' && value && !this.isValidEmail(value)) {
            isValid = false;
            errorMessage = 'Please enter a valid email address';
        }
        
        // Username validation
        if (field.id === 'signup-username' && value) {
            if (value.length < 3) {
                isValid = false;
                errorMessage = 'Username must be at least 3 characters';
            } else if (value.length > CONFIG.MAX_USERNAME_LENGTH) {
                isValid = false;
                errorMessage = `Username must be less than ${CONFIG.MAX_USERNAME_LENGTH} characters`;
            }
        }
        
        // Password validation
        if (field.type === 'password' && value && value.length < CONFIG.MIN_PASSWORD_LENGTH) {
            isValid = false;
            errorMessage = `Password must be at least ${CONFIG.MIN_PASSWORD_LENGTH} characters`;
        }
        
        // Show/hide error
        if (!isValid) {
            this.showFieldError(field, errorMessage);
        } else {
            this.clearFieldError(field);
        }
        
        return isValid;
    }
    
    /**
     * Show field error message
     */
    showFieldError(field, message) {
        // Remove existing error
        this.clearFieldError(field);
        
        // Create error element
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.textContent = message;
        errorDiv.style.color = '#c53030';
        errorDiv.style.fontSize = '12px';
        errorDiv.style.marginTop = '5px';
        errorDiv.style.marginLeft = '5px';
        
        // Insert after input wrapper
        const inputWrapper = field.closest('.input-wrapper');
        if (inputWrapper) {
            inputWrapper.parentNode.insertBefore(errorDiv, inputWrapper.nextSibling);
        }
        
        // Add error class to input
        field.classList.add('error');
    }
    
    /**
     * Clear field error message
     */
    clearFieldError(field) {
        // Remove error class
        field.classList.remove('error');
        
        // Remove error message
        const errorDiv = field.parentNode.parentNode.querySelector('.field-error');
        if (errorDiv) {
            errorDiv.remove();
        }
    }
    
    /**
     * Setup responsive behavior for different screen sizes
     */
    setupResponsiveBehavior() {
        // Handle window resize
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.handleResize();
            }, 250);
        });
    }
    
    /**
     * Handle window resize and adjust container padding
     */
    handleResize() {
        const width = window.innerWidth;
        
        // Adjust container padding for mobile
        const container = document.querySelector('.container');
        if (container) {
            if (width <= 480) {
                container.style.padding = '10px';
            } else if (width <= 768) {
                container.style.padding = '15px';
            } else {
                container.style.padding = '20px';
            }
        }
    }
    
    /**
     * Show success modal with auto-close
     */
    showSuccessModal(message) {
        const modal = document.getElementById('success-modal');
        const messageElement = document.getElementById('success-message');
        
        if (modal && messageElement) {
            messageElement.textContent = message;
            modal.classList.remove('hidden');
            
            // Auto-close after duration
            setTimeout(() => {
                this.closeSuccessModal();
            }, CONFIG.SUCCESS_MESSAGE_DURATION);
        }
    }
    
    /**
     * Close success modal
     */
    closeSuccessModal() {
        const modal = document.getElementById('success-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }
    
    /**
     * Hide loading screen with fade-out animation
     */
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.classList.add('hidden');
            }, 500);
        }
    }
    
    /**
     * Show loading screen
     */
    showLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.remove('hidden');
            loadingScreen.style.opacity = '1';
        }
    }
    
    /**
     * Global error notification
     */
    showGlobalError(message) {
        console.error('❌ Global Error:', message);
        // You can implement a global error notification here
    }
    
    /**
     * Global success notification
     */
    showGlobalSuccess(message) {
        console.log('✅ Global Success:', message);
        // You can implement a global success notification here
    }
    
    /**
     * Validate email format
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    /**
     * Check if app is ready with all managers
     */
    isReady() {
        return this.isInitialized && 
               window.authManager && 
               window.profileManager &&
               window.chatManager;
    }
    
    /**
     * Check authentication status and initialize managers
     */
    checkAuthStatus() {
        // Wait for managers to be available
        const checkManagers = () => {
            if (window.authManager && window.profileManager && window.chatManager) {
                // Check if user is already authenticated
                if (window.authManager.isAuthenticated) {
                    window.profileManager.loadProfile();
                    
                    // Initialize chat data
                    setTimeout(() => {
                        if (window.chatManager) {
                            window.chatManager.loadAllRooms();
                            window.chatManager.loadJoinedRooms();
                        }
                    }, 500);
                }
                
                return true;
            }
            return false;
        };
        
        // Try to check immediately
        if (!checkManagers()) {
            // If managers aren't ready yet, wait a bit and try again
            setTimeout(() => {
                if (!checkManagers()) {
                    setTimeout(checkManagers, 500);
                }
            }, 100);
        }
    }
    
    /**
     * Setup global authentication error handling
     */
    setupGlobalAuthErrorHandling() {
        // Intercept fetch requests to handle authentication errors
        this.setupFetchInterceptor();
        
        // Handle unhandled promise rejections (network errors)
        window.addEventListener('unhandledrejection', (event) => {
            if (event.reason && event.reason.message && 
                (event.reason.message.includes('401') || 
                 event.reason.message.includes('Unauthorized') ||
                 event.reason.message.includes('Authentication failed'))) {
                this.handleGlobalAuthError();
            }
        });
    }
    
    /**
     * Setup fetch interceptor to catch authentication errors
     */
    setupFetchInterceptor() {
        const originalFetch = window.fetch;
        
        window.fetch = async (...args) => {
            try {
                const response = await originalFetch(...args);
                
                // Check for authentication errors
                if (response.status === 401) {
                    this.handleGlobalAuthError();
                    return response;
                }
                
                return response;
            } catch (error) {
                // Handle network errors that might be auth-related
                if (error.message && error.message.includes('Failed to fetch')) {
                    console.warn('⚠️ Network error, might be auth-related:', error);
                }
                throw error;
            }
        };
    }
    
    /**
     * Handle global authentication errors
     */
    handleGlobalAuthError() {
        // Clear any existing session
        if (window.authManager) {
            window.authManager.handleSessionExpired('Authentication failed');
        } else {
            // Fallback if auth manager is not available
            localStorage.removeItem(CONFIG.SESSION_STORAGE_KEY);
            window.location.reload();
        }
    }
    
    /**
     * Show chat rooms view
     */
    showChatRooms() {
        document.getElementById('profile-container').classList.add('hidden');
        document.getElementById('chat-container').classList.remove('hidden');
        
        // Load rooms when showing chat container
        if (window.chatManager) {
            window.chatManager.loadAllRooms();
            window.chatManager.loadJoinedRooms();
        }
    }
    
    /**
     * Show profile view
     */
    showProfile() {
        document.getElementById('chat-container').classList.add('hidden');
        document.getElementById('profile-container').classList.remove('hidden');
        
        // Load profile data
        if (window.profileManager) {
            window.profileManager.loadProfile();
        }
    }
    
    /**
     * Show create room view
     */
    showCreateRoom() {
        document.getElementById('roomsView').classList.add('hidden');
        document.getElementById('createRoomView').classList.remove('hidden');
    }
    
    /**
     * Show rooms view
     */
    showRoomsView() {
        // Use chat manager's showRoomsView method if available to properly handle room leaving
        if (window.chatManager && typeof window.chatManager.showRoomsView === 'function') {
            window.chatManager.showRoomsView();
        } else {
            // Fallback to basic view switching
            document.getElementById('createRoomView').classList.add('hidden');
            document.getElementById('chatView').classList.add('hidden');
            document.getElementById('roomsView').classList.remove('hidden');
        }
    }
    
    /**
     * Switch between different room tabs
     */
    switchTab(tab) {
        // Update active tab button
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');
        
        // Hide all containers
        document.querySelectorAll('.rooms-container').forEach(container => container.classList.add('hidden'));
        
        // Show selected container
        if (tab === 'all') {
            document.getElementById('allRoomsContainer').classList.remove('hidden');
            if (window.chatManager) window.chatManager.loadAllRooms();
        } else if (tab === 'public') {
            document.getElementById('publicRoomsContainer').classList.remove('hidden');
            if (window.chatManager) window.chatManager.loadPublicRooms();
        } else if (tab === 'joined') {
            document.getElementById('joinedRoomsContainer').classList.remove('hidden');
            if (window.chatManager) window.chatManager.loadJoinedRooms();
        }
    }
    
    /**
     * Get app status and manager availability
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            authManager: !!window.authManager,
            profileManager: !!window.profileManager,
            user: window.authManager?.getCurrentUser() || null,
            authenticated: window.authManager?.checkAuth() || false
        };
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});

// Export for global access
window.App = App;
