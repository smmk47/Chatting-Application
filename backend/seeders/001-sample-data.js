'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Insert sample users (these will be created via API in production)
    // Note: Replace with actual Firebase UIDs when testing
    await queryInterface.bulkInsert('users', [
      {
        firebase_uid: 'sample_user_1',
        username: 'admin',
        email: 'admin@chatapp.com',
        display_name: 'System Admin',
        bio: 'System administrator for the chat app',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        firebase_uid: 'sample_user_2',
        username: 'moderator',
        email: 'mod@chatapp.com',
        display_name: 'Chat Moderator',
        bio: 'Helps maintain chat room order',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        firebase_uid: 'sample_user_3',
        username: 'user1',
        email: 'user1@chatapp.com',
        display_name: 'Regular User',
        bio: 'Regular chat app user',
        created_at: new Date(),
        updated_at: new Date()
      }
    ], {});

    // Insert sample chat rooms
    await queryInterface.bulkInsert('chat_rooms', [
      {
        name: 'Welcome Room',
        description: 'Welcome to our chat app! Start here to get familiar with the features.',
        is_private: false,
        max_members: 100,
        created_by: 'sample_user_1',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'General Discussion',
        description: 'General topics and discussions. Feel free to chat about anything!',
        is_private: false,
        max_members: 200,
        created_by: 'sample_user_1',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Help & Support',
        description: 'Get help and support here. Ask questions and get answers from the community.',
        is_private: false,
        max_members: 50,
        created_by: 'sample_user_2',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Private Admin Room',
        description: 'Private room for administrators only.',
        is_private: true,
        max_members: 10,
        created_by: 'sample_user_1',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Tech Talk',
        description: 'Discuss technology, programming, and technical topics.',
        is_private: false,
        max_members: 150,
        created_by: 'sample_user_2',
        created_at: new Date(),
        updated_at: new Date()
      }
    ], {});

    // Insert sample room memberships
    await queryInterface.bulkInsert('room_members', [
      {
        room_id: 1,
        firebase_uid: 'sample_user_1',
        joined_at: new Date(),
        is_owner: true,

      },
      {
        room_id: 1,
        firebase_uid: 'sample_user_2',
        joined_at: new Date(),
        is_owner: false
      },
      {
        room_id: 1,
        firebase_uid: 'sample_user_3',
        joined_at: new Date(),
        is_owner: false
      },
      {
        room_id: 2,
        firebase_uid: 'sample_user_1',
        joined_at: new Date(),
        is_owner: true
      },
      {
        room_id: 2,
        firebase_uid: 'sample_user_2',
        joined_at: new Date(),
        is_owner: false
      },
      {
        room_id: 3,
        firebase_uid: 'sample_user_2',
        joined_at: new Date(),
        is_owner: true
      },
      {
        room_id: 4,
        firebase_uid: 'sample_user_1',
        joined_at: new Date(),
        is_owner: true
      },
      {
        room_id: 5,
        firebase_uid: 'sample_user_2',
        joined_at: new Date(),
        is_owner: true
      }
    ], {});

    // Insert sample chat messages
    await queryInterface.bulkInsert('chat_messages', [
      {
        room_id: 1,
        firebase_uid: 'sample_user_1',
        message: 'Welcome to the Chat App! 🎉',
        message_type: 'text',
        created_at: new Date()
      },
      {
        room_id: 1,
        firebase_uid: 'sample_user_1',
        message: 'This is a public room where you can start chatting.',
        message_type: 'text',
        created_at: new Date()
      },
      {
        room_id: 1,
        firebase_uid: 'sample_user_2',
        message: 'Hello everyone! I\'m here to help moderate.',
        message_type: 'text',
        created_at: new Date()
      },
      {
        room_id: 1,
        firebase_uid: 'sample_user_3',
        message: 'Hi! This looks like a great chat app!',
        message_type: 'text',
        created_at: new Date()
      },
      {
        room_id: 2,
        firebase_uid: 'sample_user_1',
        message: 'General discussion is now open!',
        message_type: 'text',
        created_at: new Date()
      },
      {
        room_id: 2,
        firebase_uid: 'sample_user_2',
        message: 'Feel free to discuss any topics here.',
        message_type: 'text',
        created_at: new Date()
      },
      {
        room_id: 3,
        firebase_uid: 'sample_user_2',
        message: 'Need help? Ask your questions here!',
        message_type: 'text',
        created_at: new Date()
      },
      {
        room_id: 5,
        firebase_uid: 'sample_user_2',
        message: 'Tech discussions welcome here! 💻',
        message_type: 'text',
        created_at: new Date()
      }
    ], {});
  },

  async down(queryInterface, Sequelize) {
    // Remove data in reverse order (respecting foreign key constraints)
    await queryInterface.bulkDelete('chat_messages', null, {});
    await queryInterface.bulkDelete('room_members', null, {});
    await queryInterface.bulkDelete('chat_rooms', null, {});
    await queryInterface.bulkDelete('users', null, {});
  }
};
