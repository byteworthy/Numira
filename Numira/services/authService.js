/**
 * Authentication Service
 * 
 * Handles user authentication, password hashing, and JWT token operations.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const config = require('../config/config');

const prisma = new PrismaClient();

/**
 * Hash a password using bcrypt
 * 
 * @param {string} password - The plain text password to hash
 * @returns {Promise<{hash: string, salt: string}>} - The hashed password and salt
 */
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(config.auth.saltRounds);
  const hash = await bcrypt.hash(password, salt);
  return { hash, salt };
}

/**
 * Compare a password with a hash
 * 
 * @param {string} password - The plain text password to check
 * @param {string} hash - The hashed password to compare against
 * @returns {Promise<boolean>} - True if the password matches, false otherwise
 */
async function comparePassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

/**
 * Generate a JWT token for a user
 * 
 * @param {Object} user - The user object to generate a token for
 * @returns {string} - The JWT token
 */
function generateToken(user) {
  const payload = {
    user: {
      id: user.id,
      email: user.email
    }
  };

  return jwt.sign(
    payload,
    config.auth.jwtSecret,
    { expiresIn: config.auth.jwtExpiresIn }
  );
}

/**
 * Verify a JWT token
 * 
 * @param {string} token - The JWT token to verify
 * @returns {Object|null} - The decoded token payload or null if invalid
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, config.auth.jwtSecret);
  } catch (error) {
    return null;
  }
}

/**
 * Register a new user
 * 
 * @param {string} email - The user's email
 * @param {string} password - The user's password
 * @returns {Promise<{user: Object, token: string}>} - The created user and JWT token
 * @throws {Error} - If registration fails
 */
async function registerUser(email, password) {
  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw new Error('User already exists');
    }

    // Hash password
    const { hash, salt } = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hash,
        salt
      }
    });

    // Generate token
    const token = generateToken(user);

    // Return user (without password) and token
    const { passwordHash, salt: userSalt, ...userWithoutPassword } = user;
    
    return {
      user: userWithoutPassword,
      token
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Login a user
 * 
 * @param {string} email - The user's email
 * @param {string} password - The user's password
 * @returns {Promise<{user: Object, token: string}>} - The user and JWT token
 * @throws {Error} - If login fails
 */
async function loginUser(email, password) {
  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check password
    const isMatch = await comparePassword(password, user.passwordHash);

    if (!isMatch) {
      throw new Error('Invalid credentials');
    }

    // Generate token
    const token = generateToken(user);

    // Return user (without password) and token
    const { passwordHash, salt, ...userWithoutPassword } = user;
    
    return {
      user: userWithoutPassword,
      token
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Get user by ID
 * 
 * @param {string} userId - The user's ID
 * @returns {Promise<Object>} - The user object
 * @throws {Error} - If user not found
 */
async function getUserById(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Return user without sensitive fields
    const { passwordHash, salt, ...userWithoutPassword } = user;
    return userWithoutPassword;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  registerUser,
  loginUser,
  getUserById
};
