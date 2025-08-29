// Firebase Messaging Service Worker
// This file handles background push notifications

// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase configuration (should match your project)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "electron-cdf2a.firebaseapp.com",
    projectId: "electron-cdf2a",
    storageBucket: "electron-cdf2a.appspot.com",
    messagingSenderId: "116174850487244556754",
    appId: "YOUR_APP_ID",
    measurementId: "YOUR_MEASUREMENT_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('📱 Background message received:', payload);
    
    const { notification, data } = payload;
    
    if (notification) {
        // Show system notification
        const notificationTitle = notification.title || 'New Message';
        const notificationOptions = {
            body: notification.body || 'You have a new message',
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
        
        // Show notification
        return self.registration.showNotification(notificationTitle, notificationOptions);
    }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('📱 Notification clicked:', event);
    
    event.notification.close();
    
    // Handle different actions
    if (event.action === 'open' || !event.action) {
        // Open the app
        event.waitUntil(
            clients.openWindow('/')
        );
    }
    
    // Handle chat room navigation if data is available
    if (event.notification.data && event.notification.data.room_id) {
        const roomId = event.notification.data.room_id;
        console.log('📱 Navigating to room:', roomId);
        
        // You can implement room navigation logic here
        // For now, just open the main app
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
    console.log('📱 Notification closed:', event);
});

// Handle push event (fallback for older browsers)
self.addEventListener('push', (event) => {
    console.log('📱 Push event received:', event);
    
    if (event.data) {
        try {
            const payload = event.data.json();
            console.log('📱 Push payload:', payload);
            
            // Show notification
            const notificationTitle = payload.notification?.title || 'New Message';
            const notificationOptions = {
                body: payload.notification?.body || 'You have a new message',
                icon: payload.notification?.icon || '/favicon.ico',
                badge: '/favicon.ico',
                tag: 'chat-notification',
                data: payload.data || {},
                requireInteraction: true
            };
            
            event.waitUntil(
                self.registration.showNotification(notificationTitle, notificationOptions)
            );
            
        } catch (error) {
            console.error('❌ Error parsing push payload:', error);
            
            // Fallback notification
            const notificationTitle = 'New Message';
            const notificationOptions = {
                body: 'You have a new message',
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                tag: 'chat-notification'
            };
            
            event.waitUntil(
                self.registration.showNotification(notificationTitle, notificationOptions)
            );
        }
    }
});

// Handle install event
self.addEventListener('install', (event) => {
    console.log('📱 Service Worker installed');
    self.skipWaiting();
});

// Handle activate event
self.addEventListener('activate', (event) => {
    console.log('📱 Service Worker activated');
    event.waitUntil(self.clients.claim());
});

// Handle message events from main thread
self.addEventListener('message', (event) => {
    console.log('📱 Message received in service worker:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

console.log('✅ Firebase Messaging Service Worker loaded');
