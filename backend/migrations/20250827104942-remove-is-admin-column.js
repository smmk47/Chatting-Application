'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Remove is_admin column if it exists
    try {
      await queryInterface.removeColumn('users', 'is_admin');
    } catch (error) {
      // Column doesn't exist, which is fine
      console.log('is_admin column does not exist, skipping removal');
    }

    // Remove any other admin-related columns that might exist
    try {
      await queryInterface.removeColumn('users', 'admin');
    } catch (error) {
      // Column doesn't exist, which is fine
      console.log('admin column does not exist, skipping removal');
    }

    try {
      await queryInterface.removeColumn('users', 'role');
    } catch (error) {
      // Column doesn't exist, which is fine
      console.log('role column does not exist, skipping removal');
    }

    // Remove any admin-related indexes
    try {
      await queryInterface.removeIndex('users', 'users_is_admin');
    } catch (error) {
      // Index doesn't exist, which is fine
      console.log('is_admin index does not exist, skipping removal');
    }
  },

  async down (queryInterface, Sequelize) {
    // Add back the is_admin column if needed for rollback
    await queryInterface.addColumn('users', 'is_admin', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    // Add back the index
    await queryInterface.addIndex('users', ['is_admin']);
  }
};
