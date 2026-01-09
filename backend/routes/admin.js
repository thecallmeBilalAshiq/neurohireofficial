const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { ADMIN_EMAIL, ADMIN_PASSWORD, generateAdminToken } = require('../config/adminAuth');
const requireAdmin = require('../middleware/requireAdmin');

/**
 * Admin Authentication
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Verify admin credentials (fixed)
    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    // Generate JWT token
    const token = generateAdminToken();

    res.json({
      success: true,
      message: 'Admin login successful',
      token: token,
      admin: {
        email: ADMIN_EMAIL,
        role: 'admin',
      },
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: error.message || 'Failed to login as admin' });
  }
});

/**
 * HR Management Routes (Admin only)
 */
// Create HR account
router.post('/hr', requireAdmin, adminController.createHR);

// Get all HR accounts
router.get('/hr', requireAdmin, adminController.getAllHR);

// Get single HR account by UID
router.get('/hr/:uid', requireAdmin, adminController.getHRById);

// Update HR account
router.put('/hr/:uid', requireAdmin, adminController.updateHR);

// Block/Disable HR account
router.post('/hr/:uid/block', requireAdmin, adminController.blockHR);

// Activate/Enable HR account
router.post('/hr/:uid/activate', requireAdmin, adminController.activateHR);

// Delete HR account
router.delete('/hr/:uid', requireAdmin, adminController.deleteHR);

module.exports = router;

