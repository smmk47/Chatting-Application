'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'fcm_token', {
      type: Sequelize.TEXT,
      allowNull: true,
      after: 'password'
    });

    await queryInterface.addColumn('users', 'push_notifications_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      after: 'fcm_token'
    });

    await queryInterface.addColumn('users', 'fcm_token_updated_at', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'push_notifications_enabled'
    });

    // Add index for FCM token
    await queryInterface.addIndex('users', ['fcm_token']);
  },

  async down(queryInterface, Sequelize) {
    // Remove index
    await queryInterface.removeIndex('users', ['fcm_token']);
    
    // Remove columns
    await queryInterface.removeColumn('users', 'fcm_token_updated_at');
    await queryInterface.removeColumn('users', 'push_notifications_enabled');
    await queryInterface.removeColumn('users', 'fcm_token');
  }
};
