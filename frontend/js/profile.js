// Profile Management Module
class ProfileManager {
    constructor() {
        this.currentUser = null;
        this.avatarFile = null;
        
        this.bindEvents();
    }
    
    // Bind event listeners
    bindEvents() {
        // Profile form submission
        const profileForm = document.getElementById('profileForm');
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => this.handleProfileUpdate(e));
        }
        
        // Avatar upload
        const avatarUpload = document.getElementById('avatar-upload');
        if (avatarUpload) {
            avatarUpload.addEventListener('change', (e) => this.handleAvatarChange(e));
        }
    }
    
    // Load profile data
    async loadProfile() {
        console.log('👤 Loading profile data...');
        
        try {
            // Check if user is still authenticated
            if (!window.authManager || !window.authManager.checkAuth()) {
                console.log('🔐 User not authenticated, redirecting to login');
                window.location.reload(); // This will trigger auth flow
                return;
            }
            
            const user = window.authManager.getCurrentUser();
            if (!user) {
                console.error('❌ No authenticated user found');
                return;
            }
            
            this.currentUser = user;
            this.populateProfileForm(user);
            this.updateAvatarDisplay(user.avatar_url);
            
        } catch (error) {
            console.error('❌ Error loading profile:', error);
            this.showError('profile-error', 'Failed to load profile data');
        }
    }
    
    // Populate profile form with user data
    populateProfileForm(user) {
        const usernameInput = document.getElementById('profile-username');
        const emailInput = document.getElementById('profile-email');
        const displayNameInput = document.getElementById('profile-display-name');
        const bioInput = document.getElementById('profile-bio');
        
        if (usernameInput) usernameInput.value = user.username || '';
        if (emailInput) emailInput.value = user.email || '';
        if (displayNameInput) displayNameInput.value = user.display_name || '';
        if (bioInput) bioInput.value = user.bio || '';
        
        console.log('✅ Profile form populated');
    }
    
    // Handle profile form submission
    async handleProfileUpdate(e) {
        e.preventDefault();
        console.log('✏️ Updating profile...');
        
        try {
            this.setLoading('profileForm', true);
            this.hideError('profile-error');
            this.hideSuccess('profile-success');
            
            const formData = new FormData();
            
            // Add text fields
            const displayName = document.getElementById('profile-display-name').value.trim();
            const bio = document.getElementById('profile-bio').value.trim();
            
            if (displayName) formData.append('display_name', displayName);
            if (bio) formData.append('bio', bio);
            
            // Add avatar file if selected
            if (this.avatarFile) {
                formData.append('avatar', this.avatarFile);
            }
            
            const response = await this.updateProfile(formData);
            
            if (response.success) {
                // Update local user data
                this.currentUser = { ...this.currentUser, ...response.user };
                
                // Update avatar display
                if (response.user.avatar_url) {
                    this.updateAvatarDisplay(response.user.avatar_url);
                }
                
                // Show success message
                this.showSuccess('profile-success', 'Profile updated successfully!');
                
                // Clear avatar file
                this.avatarFile = null;
                
                // Update auth manager
                if (window.authManager) {
                    window.authManager.currentUser = this.currentUser;
                    window.authManager.saveSession();
                }
                
            } else {
                this.showError('profile-error', response.message || 'Profile update failed');
            }
            
        } catch (error) {
            console.error('❌ Profile update error:', error);
            this.showError('profile-error', error.message || 'Profile update failed. Please try again.');
        } finally {
            this.setLoading('profileForm', false);
        }
    }
    
    // Handle avatar file selection
    handleAvatarChange(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        console.log('📁 Avatar file selected:', file.name);
        
        // Validate file
        if (!this.validateAvatarFile(file)) {
            e.target.value = ''; // Clear selection
            return;
        }
        
        this.avatarFile = file;
        
        // Preview image
        this.previewAvatar(file);
        
        console.log('✅ Avatar file validated and ready for upload');
    }
    
    // Validate avatar file
    validateAvatarFile(file) {
        // Check file size
        if (file.size > CONFIG.MAX_FILE_SIZE) {
            this.showError('profile-error', `File size must be less than ${CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`);
            return false;
        }
        
        // Check file type
        if (!CONFIG.ALLOWED_FILE_TYPES.includes(file.type)) {
            this.showError('profile-error', 'Only JPG, PNG, GIF, and WebP files are allowed');
            return false;
        }
        
        return true;
    }
    
    // Preview avatar image
    previewAvatar(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const avatarImg = document.getElementById('profile-avatar');
            if (avatarImg) {
                avatarImg.src = e.target.result;
            }
        };
        reader.readAsDataURL(file);
    }
    
    // Update profile via API
    async updateProfile(formData) {
        try {
            const url = getApiUrl(getEndpoint('PROFILE'));
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${window.authManager.getSessionToken()}`,
                },
                body: formData
            });
            
            if (response.status === 401) {
                // Session expired, redirect to login
                console.log('🔐 Session expired during profile update, redirecting to login');
                window.authManager.handleSessionExpired('Session expired during profile update');
                return { success: false, message: 'Session expired' };
            }
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to update profile');
            }
            
            const data = await response.json();
            return { success: true, user: data.user };
            
        } catch (error) {
            console.error('❌ Profile update error:', error);
            throw error;
        }
    }
    
    // Update avatar display
    updateAvatarDisplay(avatarUrl) {
        const avatarImg = document.getElementById('profile-avatar');
        if (avatarImg && avatarUrl) {
            avatarImg.src = avatarUrl;
            console.log('🖼️ Avatar updated:', avatarUrl);
        }
    }
    
    // UI methods
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
    
    showSuccess(elementId, message) {
        const successElement = document.getElementById(elementId);
        if (successElement) {
            successElement.textContent = message;
            successElement.classList.remove('hidden');
            
            // Auto-hide after duration
            setTimeout(() => {
                this.hideSuccess(elementId);
            }, CONFIG.SUCCESS_MESSAGE_DURATION);
        }
    }
    
    hideSuccess(elementId) {
        const successElement = document.getElementById(elementId);
        if (successElement) {
            successElement.classList.add('hidden');
        }
    }
    
    // Get current profile data
    getCurrentProfile() {
        return this.currentUser;
    }
    
    // Check if profile has unsaved changes
    hasUnsavedChanges() {
        if (this.avatarFile) return true;
        
        const displayName = document.getElementById('profile-display-name').value.trim();
        const bio = document.getElementById('profile-bio').value.trim();
        
        return displayName !== (this.currentUser?.display_name || '') ||
               bio !== (this.currentUser?.bio || '');
    }
}

// Initialize profile manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.profileManager = new ProfileManager();
    console.log('✅ Profile manager initialized');
});
