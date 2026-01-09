const jwt = require('jsonwebtoken');

/**
 * Admin Authentication Configuration
 * Fixed admin credentials - NOT stored in database
 */
const ADMIN_EMAIL = 'faieztariq67@gmail.com';
const ADMIN_PASSWORD = 'faize@xcA@#$%';
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'neurohire-admin-secret-key-change-in-production';

/**
 * Generate JWT token for admin
 */
function generateAdminToken() {
  return jwt.sign(
    { 
      email: ADMIN_EMAIL, 
      role: 'admin',
      type: 'admin' 
    },
    ADMIN_JWT_SECRET,
    { expiresIn: '24h' }
  );
}

/**
 * Verify admin JWT token
 */
function verifyAdminToken(token) {
  try {
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET);
    if (decoded.email === ADMIN_EMAIL && decoded.role === 'admin') {
      return decoded;
    }
    throw new Error('Invalid admin token');
  } catch (error) {
    throw new Error('Invalid or expired admin token');
  }
}

module.exports = {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_JWT_SECRET,
  generateAdminToken,
  verifyAdminToken,
};
