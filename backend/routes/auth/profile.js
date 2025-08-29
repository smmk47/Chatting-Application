const express = require('express');
const { User } = require('../../models');
const { firebaseAuth } = require('../../middleware/firebaseAuth');
const cloudinary = require('../../config/cloudinary');
const upload = require('../../middleware/upload');
const fs = require('fs');

const router = express.Router();

// Get current user profile
router.get('/profile', firebaseAuth, async (req, res) => {
    try {
        const user = req.user;
        
        // Remove sensitive information (user is already a plain object from middleware)
        const { firebase_uid, ...userProfile } = user;
        
        res.json({
            message: 'Profile retrieved successfully',
            user: userProfile
        });
    } catch (error) {
        console.error('Profile retrieval error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update user profile with file upload support
router.put('/profile', firebaseAuth, upload.single('avatar'), async (req, res) => {
    try {
        console.log('✏️ PUT /profile called');
        console.log('📋 Request body:', req.body);
        console.log('📁 File:', req.file);
        
        const { display_name, bio } = req.body;
        const firebaseUid = req.user.firebase_uid;
        let avatarUrl = req.user.avatar_url; // Keep existing avatar if no new file
        
        // Handle file upload if present
        if (req.file) {
            try {
                console.log('📤 Uploading file to Cloudinary...');
                
                // Upload to Cloudinary
                const result = await cloudinary.uploader.upload(req.file.path, {
                    folder: 'avatars',
                    width: 300,
                    height: 300,
                    crop: 'fill',
                    quality: 'auto'
                });
                
                console.log('✅ File uploaded to Cloudinary:', result.secure_url);
                avatarUrl = result.secure_url;
                
                // Delete temporary file after successful upload
                fs.unlinkSync(req.file.path);
                console.log('🗑️ Temporary file deleted');
                
            } catch (uploadError) {
                console.error('❌ Cloudinary upload failed:', uploadError);
                
                // Delete temporary file if upload failed
                if (req.file && fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }
                
                return res.status(500).json({
                    message: 'Failed to upload image',
                    error: uploadError.message
                });
            }
        }
        
        // Update user profile in database
        const updateResult = await User.update(
            {
                display_name: display_name || undefined,
                bio: bio || undefined,
                avatar_url: avatarUrl || undefined
            },
            {
                where: { firebase_uid: firebaseUid },
                returning: true
            }
        );
        
        if (updateResult[0] === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Fetch updated user data
        const updatedUser = await User.findOne({ where: { firebase_uid: firebaseUid } });
        const { firebase_uid, ...userProfile } = updatedUser.toJSON();
        
        res.json({
            message: 'Profile updated successfully',
            user: userProfile,
            avatarUploaded: !!req.file
        });

    } catch (error) {
        console.error('❌ Profile update error:', error);
        
        // Clean up temporary file if error occurs
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
            console.log('🗑️ Cleaned up temporary file due to error');
        }
        
        res.status(500).json({
            message: 'Profile update failed',
            error: error.message
        });
    }
});

module.exports = router;
