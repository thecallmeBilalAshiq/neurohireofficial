const admin = require('../config/firebase');
const User = require('../models/User');

/**
 * Admin Controller
 * Manages HR accounts using Firebase Admin SDK
 * No database storage for admin/HR management - uses Firebase Auth only
 */

// Admin credentials (fixed)
const ADMIN_EMAIL = 'faieztariq67@gmail.com';
const ADMIN_PASSWORD = 'faize@xcA@#$%';

// Create HR account
exports.createHR = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    // Normalize email so we never query with undefined/empty (Mongoose findOne(undefined) can match first doc)
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!normalizedEmail) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if HR account already exists in Firebase (case-insensitive)
    try {
      const existingUser = await admin.auth().getUserByEmail(email.trim());
      return res.status(400).json({ error: 'HR account with this email already exists' });
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
      // User doesn't exist - that's fine, we'll create it
    }

    // Check if user exists in MongoDB (case-insensitive; only when email is valid to avoid findOne(undefined) bug)
    const emailMatchRegex = new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const existingMongoUser = await User.findOne({ email: emailMatchRegex });
    if (existingMongoUser) {
      return res.status(400).json({ error: 'User with this email already exists in the system' });
    }

    // Create HR account in Firebase
    const firebaseUser = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: name,
      emailVerified: true, // Auto-verify for HR accounts created by admin
      disabled: false,
    });

    // Set custom claims for HR role
    await admin.auth().setCustomUserClaims(firebaseUser.uid, {
      role: 'HR',
      createdBy: 'admin'
    });

    // Create corresponding MongoDB user document
    const mongoUser = new User({
      firebaseUid: firebaseUser.uid,
      email: email,
      name: name,
      role: 'HR',
      emailVerified: true,
    });

    await mongoUser.save();

    res.status(201).json({
      success: true,
      message: 'HR account created successfully',
      hr: {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        name: name,
        role: 'HR',
        disabled: false,
        createdAt: firebaseUser.metadata.creationTime,
      },
    });
  } catch (error) {
    console.error('Create HR error:', error);
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'HR account with this email already exists' });
    }
    if (error.code === 'auth/invalid-email') {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (error.code === 'auth/weak-password') {
      return res.status(400).json({ error: 'Password is too weak' });
    }
    res.status(500).json({ error: error.message || 'Failed to create HR account' });
  }
};

// Get all HR accounts
exports.getAllHR = async (req, res) => {
  try {
    // Get all users from MongoDB with HR role
    const hrUsers = await User.find({ role: 'HR' }).select('firebaseUid email name emailVerified createdAt updatedAt');

    // Fetch Firebase user details (including disabled status) for each HR
    const hrList = await Promise.all(
      hrUsers.map(async (mongoUser) => {
        try {
          const firebaseUser = await admin.auth().getUser(mongoUser.firebaseUid);
          return {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            name: mongoUser.name,
            role: 'HR',
            disabled: firebaseUser.disabled || false,
            emailVerified: firebaseUser.emailVerified || false,
            createdAt: firebaseUser.metadata.creationTime,
            lastSignIn: firebaseUser.metadata.lastSignInTime || null,
          };
        } catch (error) {
          // If Firebase user not found, still return MongoDB user data
          console.error(`Error fetching Firebase user ${mongoUser.firebaseUid}:`, error);
          return {
            uid: mongoUser.firebaseUid,
            email: mongoUser.email,
            name: mongoUser.name,
            role: 'HR',
            disabled: true, // Mark as disabled if Firebase user not found
            emailVerified: mongoUser.emailVerified || false,
            createdAt: mongoUser.createdAt,
            lastSignIn: null,
          };
        }
      })
    );

    // Sort by creation date (newest first)
    hrList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      success: true,
      hrAccounts: hrList,
      total: hrList.length,
    });
  } catch (error) {
    console.error('Get all HR error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch HR accounts' });
  }
};

// Get single HR account by UID
exports.getHRById = async (req, res) => {
  try {
    const { uid } = req.params;

    if (!uid) {
      return res.status(400).json({ error: 'HR UID is required' });
    }

    // Get from MongoDB
    const mongoUser = await User.findOne({ firebaseUid: uid, role: 'HR' });

    if (!mongoUser) {
      return res.status(404).json({ error: 'HR account not found' });
    }

    // Get Firebase user details
    const firebaseUser = await admin.auth().getUser(uid);

    res.json({
      success: true,
      hr: {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        name: mongoUser.name,
        role: 'HR',
        disabled: firebaseUser.disabled || false,
        emailVerified: firebaseUser.emailVerified || false,
        createdAt: firebaseUser.metadata.creationTime,
        lastSignIn: firebaseUser.metadata.lastSignInTime || null,
      },
    });
  } catch (error) {
    console.error('Get HR by ID error:', error);
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({ error: 'HR account not found' });
    }
    res.status(500).json({ error: error.message || 'Failed to fetch HR account' });
  }
};

// Update HR account (name and/or email)
exports.updateHR = async (req, res) => {
  try {
    const { uid } = req.params;
    const { name, email } = req.body;

    if (!uid) {
      return res.status(400).json({ error: 'HR UID is required' });
    }

    // Check if HR exists
    const mongoUser = await User.findOne({ firebaseUid: uid, role: 'HR' });
    if (!mongoUser) {
      return res.status(404).json({ error: 'HR account not found' });
    }

    // Prepare update object for Firebase
    const updateData = {};

    if (name) {
      updateData.displayName = name;
      // Also update MongoDB
      mongoUser.name = name;
    }

    if (email) {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Check if email is already in use
      try {
        const existingUser = await admin.auth().getUserByEmail(email);
        if (existingUser.uid !== uid) {
          return res.status(400).json({ error: 'Email is already in use by another account' });
        }
      } catch (error) {
        if (error.code !== 'auth/user-not-found') {
          throw error;
        }
      }

      updateData.email = email;
      // Also update MongoDB
      mongoUser.email = email;
    }

    // Update Firebase user
    if (Object.keys(updateData).length > 0) {
      await admin.auth().updateUser(uid, updateData);
      await mongoUser.save();
    }

    // Get updated user
    const firebaseUser = await admin.auth().getUser(uid);

    res.json({
      success: true,
      message: 'HR account updated successfully',
      hr: {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        name: mongoUser.name,
        role: 'HR',
        disabled: firebaseUser.disabled || false,
        emailVerified: firebaseUser.emailVerified || false,
        createdAt: firebaseUser.metadata.creationTime,
        lastSignIn: firebaseUser.metadata.lastSignInTime || null,
      },
    });
  } catch (error) {
    console.error('Update HR error:', error);
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({ error: 'HR account not found' });
    }
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'Email is already in use by another account' });
    }
    if (error.code === 'auth/invalid-email') {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    res.status(500).json({ error: error.message || 'Failed to update HR account' });
  }
};

// Block/Disable HR account
exports.blockHR = async (req, res) => {
  try {
    const { uid } = req.params;

    if (!uid) {
      return res.status(400).json({ error: 'HR UID is required' });
    }

    // Check if HR exists
    const mongoUser = await User.findOne({ firebaseUid: uid, role: 'HR' });
    if (!mongoUser) {
      return res.status(404).json({ error: 'HR account not found' });
    }

    // Disable Firebase user
    await admin.auth().updateUser(uid, { disabled: true });

    res.json({
      success: true,
      message: 'HR account blocked successfully',
    });
  } catch (error) {
    console.error('Block HR error:', error);
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({ error: 'HR account not found' });
    }
    res.status(500).json({ error: error.message || 'Failed to block HR account' });
  }
};

// Activate/Enable HR account
exports.activateHR = async (req, res) => {
  try {
    const { uid } = req.params;

    if (!uid) {
      return res.status(400).json({ error: 'HR UID is required' });
    }

    // Check if HR exists
    const mongoUser = await User.findOne({ firebaseUid: uid, role: 'HR' });
    if (!mongoUser) {
      return res.status(404).json({ error: 'HR account not found' });
    }

    // Enable Firebase user
    await admin.auth().updateUser(uid, { disabled: false });

    res.json({
      success: true,
      message: 'HR account activated successfully',
    });
  } catch (error) {
    console.error('Activate HR error:', error);
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({ error: 'HR account not found' });
    }
    res.status(500).json({ error: error.message || 'Failed to activate HR account' });
  }
};

// Delete HR account
exports.deleteHR = async (req, res) => {
  try {
    const { uid } = req.params;

    if (!uid) {
      return res.status(400).json({ error: 'HR UID is required' });
    }

    // Check if HR exists
    const mongoUser = await User.findOne({ firebaseUid: uid, role: 'HR' });
    if (!mongoUser) {
      return res.status(404).json({ error: 'HR account not found' });
    }

    // Delete from Firebase
    await admin.auth().deleteUser(uid);

    // Delete from MongoDB
    await User.deleteOne({ firebaseUid: uid });

    res.json({
      success: true,
      message: 'HR account deleted successfully',
    });
  } catch (error) {
    console.error('Delete HR error:', error);
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({ error: 'HR account not found' });
    }
    res.status(500).json({ error: error.message || 'Failed to delete HR account' });
  }
};

