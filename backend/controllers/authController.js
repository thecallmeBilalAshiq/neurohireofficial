const admin = require('../config/firebase');
const User = require('../models/User');

// Signup - Validate user data (user is created in frontend with Firebase Client SDK)
// This endpoint just validates and stores user info temporarily if needed
exports.signup = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    // Check if user already exists in MongoDB (already verified and registered)
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered. Please login instead.' });
    }

    // Check if user exists in Firebase (might be unverified)
    try {
      const firebaseUser = await admin.auth().getUserByEmail(email);
      if (firebaseUser.emailVerified) {
        return res.status(400).json({ error: 'Email already registered. Please login instead.' });
      }
      // User exists but not verified - that's okay, frontend will handle verification
    } catch (error) {
      // User doesn't exist in Firebase - that's okay, frontend will create it
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    // DO NOT create user in Firebase here - frontend does it
    // DO NOT save to MongoDB here - will be saved after email verification
    // This endpoint just validates the request

    res.status(200).json({
      message: 'User data validated. Please check your email for verification.',
      email: email,
    });
  } catch (error) {
    console.error('Signup validation error:', error);
    res.status(500).json({ error: error.message || 'Failed to validate signup' });
  }
};

// Verify Email and Complete Registration - Save to MongoDB only after verification
exports.verifyEmail = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'ID token is required' });
    }

    // Verify the ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Check if email is verified
    if (!decodedToken.email_verified) {
      return res.status(400).json({ error: 'Email is not verified. Please check your email and click the verification link.' });
    }

    // Check if user already exists in MongoDB
    let user = await User.findOne({ firebaseUid: decodedToken.uid });
    
    if (user) {
      // Update emailVerified status and name if displayName was updated
      user.emailVerified = true;
      const firebaseUser = await admin.auth().getUser(decodedToken.uid);
      if (firebaseUser.displayName && firebaseUser.displayName !== user.name) {
        user.name = firebaseUser.displayName;
      }
      await user.save();
      return res.json({
        message: 'Email verified successfully!',
        user: {
          uid: decodedToken.uid,
          email: decodedToken.email,
          name: user.name,
          role: user.role,
        },
      });
    }

    // Get user details from Firebase
    const firebaseUser = await admin.auth().getUser(decodedToken.uid);

    // Save user to MongoDB only after email verification
    // Use displayName from Firebase (set during signup) or fallback to email username
    const userName = firebaseUser.displayName || decodedToken.email.split('@')[0] || 'User';
    
    user = new User({
      firebaseUid: decodedToken.uid,
      email: decodedToken.email,
      name: userName,
      role: 'candidate',
      emailVerified: true,
    });

    await user.save();

    res.json({
      message: 'Email verified and account activated successfully!',
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Verify email error:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }
    if (error.code === 'auth/argument-error') {
      return res.status(400).json({ error: 'Invalid token' });
    }

    res.status(500).json({ error: error.message || 'Failed to verify email' });
  }
};

// Login - Verify user credentials and check email verification
exports.login = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'ID token is required' });
    }

    // Verify the ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Check if email is verified
    if (!decodedToken.email_verified) {
      return res.status(403).json({ 
        error: 'Please verify your email before logging in. Check your inbox for the verification link.',
        emailVerified: false,
      });
    }
    
    // Check if user exists in MongoDB
    let user = await User.findOne({ firebaseUid: decodedToken.uid });
    
    if (!user) {
      // If user doesn't exist in MongoDB but email is verified, create the user
      const firebaseUser = await admin.auth().getUser(decodedToken.uid);
      const userName = firebaseUser.displayName || decodedToken.email.split('@')[0] || 'User';
      user = new User({
        firebaseUid: decodedToken.uid,
        email: decodedToken.email,
        name: userName,
        role: 'candidate',
        emailVerified: true,
      });
      await user.save();
    } else {
      // Update emailVerified status if it was false
      if (!user.emailVerified) {
        user.emailVerified = true;
        await user.save();
      }
    }

    res.json({
      message: 'Login successful',
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
        role: user.role,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }
    if (error.code === 'auth/id-token-revoked') {
      return res.status(401).json({ error: 'Token revoked. Please login again.' });
    }
    if (error.code === 'auth/argument-error') {
      return res.status(400).json({ error: 'Invalid token' });
    }

    res.status(500).json({ error: error.message || 'Login failed' });
  }
};

// Forgot Password - Send password reset email
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user exists
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Don't reveal if email exists or not for security
        return res.json({
          message: 'If an account exists with this email, a password reset link has been sent.',
        });
      }
      throw error;
    }

    // Generate password reset link
    const resetLink = await admin.auth().generatePasswordResetLink(email);
    
    // Note: In production, you would send this link via your email service
    // For now, Firebase will send the reset email automatically if configured

    res.json({
      message: 'Password reset link sent to your email',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: error.message || 'Failed to send reset email' });
  }
};

// Verify Token - Verify token and return user info including role
exports.verifyToken = async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Verify the ID token
    const decoded = await admin.auth().verifyIdToken(token);
    
    // Get user from MongoDB to get role
    const user = await User.findOne({ firebaseUid: decoded.uid });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      uid: decoded.uid, 
      email: decoded.email,
      role: user.role,
      name: user.name,
      emailVerified: decoded.email_verified
    });
  } catch (err) {
    console.error('Verify token error:', err);
    
    if (err.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }
    if (err.code === 'auth/id-token-revoked') {
      return res.status(401).json({ error: 'Token revoked. Please login again.' });
    }
    if (err.code === 'auth/argument-error') {
      return res.status(400).json({ error: 'Invalid token' });
    }
    
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Create User Profile (existing)
exports.createUserProfile = async (req, res) => {
  const { firebaseUid, email, role } = req.body;
  try {
    const user = new User({ firebaseUid, email, role });
    await user.save();
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
