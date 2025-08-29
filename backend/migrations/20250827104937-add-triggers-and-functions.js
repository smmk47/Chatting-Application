'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Create function to update updated_at timestamp
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Create trigger for users table
    await queryInterface.sequelize.query(`
      CREATE TRIGGER update_users_updated_at 
      BEFORE UPDATE ON users 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    // Create trigger for chat_rooms table
    await queryInterface.sequelize.query(`
      CREATE TRIGGER update_chat_rooms_updated_at 
      BEFORE UPDATE ON chat_rooms 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    // Create function to check room membership
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION check_room_membership(
        p_room_id INTEGER,
        p_firebase_uid VARCHAR(128)
      )
      RETURNS BOOLEAN AS $$
      BEGIN
        RETURN EXISTS (
          SELECT 1 FROM room_members 
          WHERE room_id = p_room_id 
          AND firebase_uid = p_firebase_uid
        );
      END;
      $$ language 'plpgsql';
    `);

    // Create function to get room member count
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION get_room_member_count(p_room_id INTEGER)
      RETURNS INTEGER AS $$
      BEGIN
        RETURN (
          SELECT COUNT(*) FROM room_members 
          WHERE room_id = p_room_id
        );
      END;
      $$ language 'plpgsql';
    `);
  },

  async down (queryInterface, Sequelize) {
    // Drop triggers
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
    `);
    
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS update_chat_rooms_updated_at ON chat_rooms;
    `);

    // Drop functions
    await queryInterface.sequelize.query(`
      DROP FUNCTION IF EXISTS update_updated_at_column();
    `);
    
    await queryInterface.sequelize.query(`
      DROP FUNCTION IF EXISTS check_room_membership(INTEGER, VARCHAR);
    `);
    
    await queryInterface.sequelize.query(`
      DROP FUNCTION IF EXISTS get_room_member_count(INTEGER);
    `);
  }
};
