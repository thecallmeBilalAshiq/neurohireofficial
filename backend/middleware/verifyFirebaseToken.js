const admin = require('../config/firebase');
const User = require('../models/User');

/**
 * Shared middleware to verify Firebase token and get user
 * Also checks if user account is disabled (for HR accounts)
 * Auto-provisions MongoDB user from Firebase custom claims if needed
 */
const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Check if Firebase user is disabled
    const firebaseUser = await admin.auth().getUser(decodedToken.uid);
    if (firebaseUser.disabled) {
      return res.status(403).json({ 
        error: 'Your account has been blocked. Please contact the administrator.' 
      });
    }
    
    // Get custom claims from Firebase user (set by admin when creating HR accounts)
    const customClaims = firebaseUser.customClaims || {};
    const role = customClaims.role || 'candidate'; // Default to candidate if no role claim
    
    // Get user from MongoDB or create from Firebase custom claims
    let user = await User.findOne({ firebaseUid: decodedToken.uid });
    
    if (!user) {
      // Auto-provision: Create MongoDB user from Firebase custom claims
      const userName = firebaseUser.displayName || decodedToken.email.split('@')[0] || 'User';
      
      user = new User({
        firebaseUid: decodedToken.uid,
        email: decodedToken.email,
        name: userName,
        role: role,
        emailVerified: decodedToken.email_verified || false,
      });
      
      await user.save();
    } else {
      // Sync role from Firebase custom claims if it exists and differs
      if (customClaims.role && customClaims.role !== user.role) {
        user.role = customClaims.role;
        await user.save();
      }
    }

    req.user = user;
    req.firebaseUser = firebaseUser; // Attach Firebase user for additional checks
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }
    if (error.code === 'auth/user-disabled') {
      return res.status(403).json({ 
        error: 'Your account has been blocked. Please contact the administrator.' 
      });
    }
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = verifyFirebaseToken;
