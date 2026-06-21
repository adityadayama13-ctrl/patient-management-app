require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || null,
    database: process.env.DB_NAME     || 'postgres',
    host:     process.env.DB_HOST     || '127.0.0.1',
    port:     process.env.DB_PORT     || 5432,
    dialect:  'postgres',
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host:     process.env.DB_HOST     || '127.0.0.1',
    port:     process.env.DB_PORT     || 5432,
    dialect:  'postgres',
  },
};
