const sequelize = require('../config/sequelize');
const User = require('./User');
const ChatRoom = require('./ChatRoom');
const RoomMember = require('./RoomMember');
const ChatMessage = require('./ChatMessage');

// Define associations
// User associations
User.hasMany(RoomMember, { 
  foreignKey: 'firebase_uid', 
  sourceKey: 'firebase_uid',
  as: 'RoomMembers'
});
User.hasMany(ChatMessage, { 
  foreignKey: 'firebase_uid', 
  sourceKey: 'firebase_uid',
  as: 'ChatMessages'
});
User.hasMany(ChatRoom, { 
  foreignKey: 'created_by', 
  sourceKey: 'firebase_uid',
  as: 'ChatRooms'
});

// ChatRoom associations
ChatRoom.belongsTo(User, { 
  foreignKey: 'created_by', 
  targetKey: 'firebase_uid',
  as: 'Creator'
});
ChatRoom.hasMany(RoomMember, { 
  foreignKey: 'room_id', 
  sourceKey: 'id',
  as: 'RoomMembers'
});
ChatRoom.hasMany(ChatMessage, { 
  foreignKey: 'room_id', 
  sourceKey: 'id',
  as: 'ChatMessages'
});

// RoomMember associations
RoomMember.belongsTo(User, { 
  foreignKey: 'firebase_uid', 
  targetKey: 'firebase_uid',
  as: 'User'
});
RoomMember.belongsTo(ChatRoom, { 
  foreignKey: 'room_id', 
  targetKey: 'id',
  as: 'ChatRoom'
});

// ChatMessage associations
ChatMessage.belongsTo(User, { 
  foreignKey: 'firebase_uid', 
  targetKey: 'firebase_uid',
  as: 'User'
});
ChatMessage.belongsTo(ChatRoom, { 
  foreignKey: 'room_id', 
  targetKey: 'id',
  as: 'ChatRoom'
});

// Sync models with database (in development)
const syncModels = async () => {
  try {
    // Force: false means it won't drop existing tables
    // Alter: true means it will update existing tables if needed
    await sequelize.sync({ force: false, alter: true });
    console.log('✅ All models synchronized with database');
  } catch (error) {
    console.error('❌ Error synchronizing models:', error);
  }
};

// Export models and sync function
module.exports = {
  sequelize,
  User,
  ChatRoom,
  RoomMember,
  ChatMessage,
  syncModels
};
