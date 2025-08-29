const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  firebase_uid: {
    type: DataTypes.STRING(128),
    allowNull: false,
    unique: true,
    field: 'firebase_uid'
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  display_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'display_name'
  },
  avatar_url: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'avatar_url'
  },
  bio: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  // FCM token for push notifications
  fcm_token: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'fcm_token'
  },
  // Notification preferences
  push_notifications_enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'push_notifications_enabled'
  },
  // Last FCM token update
  fcm_token_updated_at: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'fcm_token_updated_at'
  }

}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['firebase_uid']
    },
    {
      fields: ['email']
    },
    {
      fields: ['username']
    },
    {
      fields: ['fcm_token']
    }
  ]
});

module.exports = User;
