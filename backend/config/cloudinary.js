const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Configure Cloudinary with your credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Test Cloudinary connection
cloudinary.api.ping()
  .then(result => {
    console.log('✅ Cloudinary connected successfully');
    console.log('☁️  Cloud name:', 'dbgmzfwg1');
  })
  .catch(error => {
    console.error('❌ Cloudinary connection failed:', error.message);
  });

module.exports = cloudinary;
