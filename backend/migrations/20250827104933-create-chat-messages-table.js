'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('chat_messages', {
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
      message: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      message_type: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'text'
      },
      // File metadata fields
      file_url: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      file_name: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      file_type: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      file_size: {
        type: Sequelize.BIGINT,
        allowNull: true
      },
      file_public_id: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('chat_messages', ['room_id']);
    await queryInterface.addIndex('chat_messages', ['firebase_uid']);
    await queryInterface.addIndex('chat_messages', ['created_at']);
    await queryInterface.addIndex('chat_messages', ['message_type']);
    await queryInterface.addIndex('chat_messages', ['file_type']);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('chat_messages');
  }
};
