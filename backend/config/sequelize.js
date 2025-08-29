const { Sequelize } = require('sequelize');
require('dotenv').config();

// Debug logging
console.log('Sequelize Configuration:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***' : 'undefined');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'chatapp',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'password',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: true, // Set to console.log to see SQL queries
    pool: {
      max: 20,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: true,
      freezeTableName: true
    }
  }
);

// Test the connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Sequelize database connection test successful');
  } catch (err) {
    console.error('❌ Sequelize database connection test failed:', err.message);
    process.exit(1);
  }
};

// Run connection test
testConnection();

module.exports = sequelize;
