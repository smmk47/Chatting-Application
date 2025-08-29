'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('room_members', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      room_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'chat_rooms',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      firebase_uid: {
        type: Sequelize.STRING(128),
        allowNull: false,
        references: {
          model: 'users',
          key: 'firebase_uid'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      joined_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      is_owner: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      }
    });

    // Add indexes
    await queryInterface.addIndex('room_members', ['room_id']);
    await queryInterface.addIndex('room_members', ['firebase_uid']);
    await queryInterface.addIndex('room_members', ['joined_at']);
    
    // Add unique constraint for room_id and firebase_uid combination
    await queryInterface.addIndex('room_members', ['room_id', 'firebase_uid'], {
      unique: true
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('room_members');
  }
};
