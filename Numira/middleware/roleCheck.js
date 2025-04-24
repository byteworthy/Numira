/**
 * Role-based access control middleware
 * This is a placeholder implementation that will be expanded later
 */

/**
 * Factory function that returns a middleware to check user roles for access control
 * @param {String|Array} requiredRoles - The role(s) required to access the resource
 * @returns {Function} Express middleware function
 */
const roleCheck = (requiredRoles) => {
  return (req, res, next) => {
    // Convert to array if a string is provided
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    
    console.log(`roleCheck middleware hit - required roles: ${roles.join(', ')}`);
    // Future implementation will check user roles from req.user
    // and determine if the user has permission to access the requested resource
    
    next();
  };
};

module.exports = roleCheck;
