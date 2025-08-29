const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const RoomMember = sequelize.define('RoomMember', {
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
  joined_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'joined_at'
  },
  is_owner: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_owner'
  },

}, {
  tableName: 'room_members',
  timestamps: false,
  indexes: [
    {
      fields: ['room_id']
    },
    {
      fields: ['firebase_uid']
    },
    {
      fields: ['joined_at']
    },
    {
      unique: true,
      fields: ['room_id', 'firebase_uid']
    }
  ]
});

module.exports = RoomMember;
