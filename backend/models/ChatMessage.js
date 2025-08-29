const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const ChatMessage = sequelize.define('ChatMessage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  room_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'room_id',
    references: {
      model: 'chat_rooms',
      key: 'id'
    }
  },
  firebase_uid: {
    type: DataTypes.STRING(128),
    allowNull: false,
    field: 'firebase_uid',
    references: {
      model: 'users',
      key: 'firebase_uid'
    }
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  message_type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'text',
    field: 'message_type'
  },
  // File metadata fields
  file_url: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'file_url'
  },
  file_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'file_name'
  },
  file_type: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'file_type'
  },
  file_size: {
    type: DataTypes.BIGINT,
    allowNull: true,
    field: 'file_size'
  },
  file_public_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'file_public_id'
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  }
}, {
  tableName: 'chat_messages',
  timestamps: false,
  indexes: [
    {
      fields: ['room_id']
    },
    {
      fields: ['firebase_uid']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['message_type']
    },
    {
      fields: ['file_type']
    }
  ]
});

module.exports = ChatMessage;
