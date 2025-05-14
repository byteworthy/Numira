/**
 * Authentication Middleware
 * 
 * Verifies JWT tokens from request headers.
 * Supports both 'x-auth-token' header and 'Authorization: Bearer' format
 * for better mobile client compatibility.
 */

const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  // Get token from header - support both formats
  let token = req.header('x-auth-token');
  
  // Check for Authorization header (Bearer token)
  const authHeader = req.header('Authorization');
  if (!token && authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  // Check if no token
  if (!token) {
    return res.status(401).json({ 
      success: false,
      message: 'Authentication required',
      errors: [{ msg: 'No authentication token provided' }]
    });
  }

  // Verify token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    req.user = decoded.user;
    next();
  } catch (err) {
    return res.status(401).json({ 
      success: false,
      message: 'Authentication failed',
      errors: [{ msg: 'Invalid or expired token' }]
    });
  }
};
