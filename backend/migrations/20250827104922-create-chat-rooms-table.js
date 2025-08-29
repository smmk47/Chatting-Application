'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('chat_rooms', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      is_private: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      password_hash: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      created_by: {
        type: Sequelize.STRING(128),
        allowNull: true,
        references: {
          model: 'users',
          key: 'firebase_uid'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      max_members: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 100
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('chat_rooms', ['created_by']);
    await queryInterface.addIndex('chat_rooms', ['is_private']);
    await queryInterface.addIndex('chat_rooms', ['created_at']);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('chat_rooms');
  }
};
