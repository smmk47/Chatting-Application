const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const ChatRoom = sequelize.define('ChatRoom', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  is_private: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_private'
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'password_hash'
  },
  created_by: {
    type: DataTypes.STRING(128),
    allowNull: true,
    field: 'created_by',
    references: {
      model: 'users',
      key: 'firebase_uid'
    }
  },
  max_members: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 100,
    field: 'max_members'
  }
}, {
  tableName: 'chat_rooms',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['created_by']
    },
    {
      fields: ['is_private']
    },
    {
      fields: ['created_at']
    }
  ]
});

module.exports = ChatRoom;
