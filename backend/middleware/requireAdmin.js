const { verifyAdminToken } = require('../config/adminAuth');

/**
 * Middleware to verify admin JWT token
 * Used for admin-only routes
 */
const requireAdmin = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No admin token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decoded = verifyAdminToken(token);

    // Attach admin info to request
    req.admin = {
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    console.error('Admin token verification error:', error);
    return res.status(401).json({ error: 'Invalid or expired admin token' });
  }
};

module.exports = requireAdmin;
