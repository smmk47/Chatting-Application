// Firebase Configuration for Frontend
// This file should be customized with your Firebase project settings

// Firebase configuration object
const firebaseConfig = {
    apiKey: "AIzaSyDxCQ-2io3QUaAdk6eVByeBbP9SLcDlwEk",
    authDomain: "electron-cdf2a.firebaseapp.com",
    projectId: "electron-cdf2a",
    storageBucket: "electron-cdf2a.firebasestorage.app",
    messagingSenderId: "598403200139",
    appId: "1:598403200139:web:d460b35037b45710d7908e",
    measurementId: "G-1R79VZP0JC"
  };

// Initialize Firebase
if (typeof firebase !== 'undefined') {
    try {
        firebase.initializeApp(firebaseConfig);
        console.log('✅ Firebase initialized successfully');
        
        // Initialize Firebase Messaging
        if (firebase.messaging) {
            console.log('✅ Firebase Messaging available');
        } else {
            console.warn('⚠️ Firebase Messaging not available');
        }
        
    } catch (error) {
        console.error('❌ Firebase initialization failed:', error);
    }
} else {
    console.warn('⚠️ Firebase SDK not loaded');
}

// Export configuration for use in other modules
window.firebaseConfig = firebaseConfig;
