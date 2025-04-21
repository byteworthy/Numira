const pool = require('../config/db');

async function createUser({ name, email, password }) {
  const result = await pool.query(
    `
    INSERT INTO users (name, email, password)
    VALUES ($1, $2, $3)
    RETURNING id, name, email, created_at
    `,
    [name, email, password]
  );
  return result.rows[0];
}

async function findUserByEmail(email) {
  const result = await pool.query(
    `
    SELECT * FROM users
    WHERE email = $1
    `,
    [email]
  );
  return result.rows[0];
}

async function updateUserPreferences(userId, { theme, defaultPersona, notificationsEnabled }) {
  const result = await pool.query(
    `
    UPDATE users
    SET
      theme = $1,
      default_persona = $2,
      notifications_enabled = $3
    WHERE id = $4
    RETURNING id, name, email, theme, default_persona, notifications_enabled
    `,
    [theme, defaultPersona, notificationsEnabled, userId]
  );
  return result.rows[0];
}

module.exports = {
  createUser,
  findUserByEmail,
  updateUserPreferences
};
