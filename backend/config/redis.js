const redis = require('redis');
require('dotenv').config();

// Create Redis client
const client = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Handle Redis connection events
client.on('connect', () => {
  console.log('✅ Redis client connected');
});

client.on('error', (err) => {
  console.error('❌ Redis Client Error:', err);
});

client.on('ready', () => {
  console.log('✅ Redis client ready');
});

client.on('end', () => {
  console.log('🔌 Redis client disconnected');
});

// Connect to Redis
const connectRedis = async () => {
  try {
    await client.connect();
    console.log('✅ Redis connection established');
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    console.log('⚠️ Continuing without Redis (sessions will not be stored)');
  }
};

// Initialize connection
connectRedis();

module.exports = client;
