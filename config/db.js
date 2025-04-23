const { Pool } = require('pg');
const config = require('./config');
const logger = require('../utils/logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test the connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    logger.error(`PostgreSQL Connection Error: ${err.message}`);
  } else {
    logger.info('PostgreSQL Connected');
  }
});

module.exports = pool;