'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      console.log('🔧 Adding unique constraint to FCM tokens...');
      
      // Add unique constraint on fcm_token (excluding NULL values)
      await queryInterface.addConstraint('users', {
        fields: ['fcm_token'],
        type: 'unique',
        name: 'users_fcm_token_unique',
        where: {
          fcm_token: {
            [Sequelize.Op.ne]: null
          }
        }
      });
      
      console.log('✅ FCM token unique constraint added successfully');
      
    } catch (error) {
      console.error('❌ Error adding FCM token unique constraint:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      console.log('🔧 Removing FCM token unique constraint...');
      
      // Remove the unique constraint
      await queryInterface.removeConstraint('users', 'users_fcm_token_unique');
      
      console.log('✅ FCM token unique constraint removed successfully');
      
    } catch (error) {
      console.error('❌ Error removing FCM token unique constraint:', error);
      throw error;
    }
  }
};
