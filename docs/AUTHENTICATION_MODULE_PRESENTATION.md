# NeuroHire — Authentication Module (Login / Signup) — Presentation Pack

Single structured document for FYP slides, diagrams, and technical reference. Based on the repository source code.

---

## 1. MODULE OVERVIEW

### What is this module?

The **Authentication module** is the part of NeuroHire that lets **candidates** and **HR users** create accounts, confirm their email, sign in securely, and reset forgotten passwords. It combines **Firebase Authentication** (client-side sign-in and password handling) with a **Node/Express API** that verifies Firebase ID tokens and keeps a **MongoDB `User`** record in sync (including **role**: `candidate` or `HR` from Firebase custom claims).

### What problem does it solve?

- **Centralized identity:** Firebase handles passwords and email verification; the backend trusts verified ID tokens instead of storing passwords.
- **App-specific profile:** MongoDB stores `role`, `name`, and `emailVerified` for authorization and HR vs candidate routing.
- **Safe onboarding:** Signup sends a verification email before full access; login refuses unverified accounts (client and server checks).

### FYP slide summary (2–3 lines)

> NeuroHire uses **Firebase Authentication** for secure signup and login, and a **custom Express API** to verify each session and sync user profiles in **MongoDB**. **Email verification** is required before access, and roles (**Candidate** / **HR**) drive which dashboard each user sees after login.

---

## 2. ALL FILES INVOLVED IN THIS MODULE

### Frontend

| Full path | Role |
|-----------|------|
| `frontend/app/auth/signup/page.js` | Signup UI: Firebase user creation, verification email, backend validation via `signup()` |
| `frontend/app/auth/login/page.js` | Login UI: Firebase sign-in, ID token, backend `login()`, redirect by role |
| `frontend/app/auth/forgot-password/page.js` | Password reset UI via Firebase `sendPasswordResetEmail` (does **not** call backend `/auth/forgot-password`) |
| `frontend/lib/firebase.js` | Firebase app init + `auth` export (`NEXT_PUBLIC_FIREBASE_*` env) |
| `frontend/lib/api.js` | `signup`, `login`, `verifyEmail`, `forgotPassword`, `verifyToken` HTTP helpers |
| `frontend/lib/config.js` | Endpoint path constants under `endpoints.auth` |
| `frontend/components/ProtectedRoute.jsx` | Guards HR/candidate routes: Firebase session + `POST /auth/verify-token` |
| `frontend/components/BrandLogo.jsx` | Logo on auth pages |
| `frontend/components/signup-form.jsx` | **Alternate** signup-style component (simulated API in file); **not** used by `app/auth/signup/page.js` |
| `frontend/components/password-field.jsx` | Shared password UI (used elsewhere; auth pages mostly inline inputs) |
| `frontend/components/password-strength-hint.jsx` | Strength hints (used with `signup-form`, not the main signup page) |
| `frontend/app/layout.js` | Root layout (Toast provider wraps app) |
| `frontend/app/providers.jsx` | Toast container for auth feedback |

### Backend

| Full path | Role |
|-----------|------|
| `backend/routes/auth.js` | Mounts `/signup`, `/verify-email`, `/login`, `/forgot-password`, `/verify-token`, `/create-profile` |
| `backend/controllers/authController.js` | All auth business logic |
| `backend/config/firebase.js` | Firebase **Admin** SDK init (service account JSON file or `FIREBASE_SERVICE_ACCOUNT_JSON`) |
| `backend/index.js` | `app.use('/api/auth', authRoutes)` |

### Database

| Full path | Role |
|-----------|------|
| `backend/models/User.js` | Mongoose schema for app users linked to Firebase |

### Other

| Full path | Role |
|-----------|------|
| `neurohire-c4e9f-firebase-adminsdk-*.json` (repo root) | Fallback Firebase Admin credentials if env JSON not set |

**Not present:** No migrations/seeders for `User` in this repo (Mongoose only).

---

## 3. DATA FLOW DESCRIPTION (FOR DIAGRAM GENERATION)

### 3A — Step-by-step narrative (detailed)

**A) Signup (new candidate self-registration)**

1. User fills name, email, password on **Signup** → submits form.  
2. **`frontend/app/auth/signup/page.js`** runs **`onSubmit`** (via `react-hook-form` `handleSubmit`).  
3. **`createUserWithEmailAndPassword(auth, email, password)`** (Firebase Client SDK) creates the auth user.  
4. **`updateProfile(user, { displayName: name })`** sets display name in Firebase.  
5. **`sendEmailVerification(user, { url: …/auth/login })`** asks Firebase to email a verification link.  
6. **`signup({ name, email, password })`** in **`frontend/lib/api.js`** → **`POST /api/auth/signup`** with JSON body.  
7. **`authController.signup`** runs: checks **`User`** in MongoDB by email; checks Firebase user by email via **`admin.auth().getUserByEmail`**; does **not** create Mongo user; returns success message.  
8. Response returns to browser → client **`auth.signOut()`** so unverified users are not left signed in.  
9. Toast + redirect to **`/auth/login`**.

**B) Email verification (Firebase-side)**

- User clicks link in email → Firebase marks **`email_verified`** on the Firebase user.  
- **Note:** `POST /api/auth/verify-email` exists and would create/update **`User`** in MongoDB, but **no frontend page imports `verifyEmail` from `api.js`** in this codebase.  
- **Observed path:** After verification, user opens **Login**; MongoDB profile is created/updated on **`POST /api/auth/login`** (see flow C).

**C) Login**

1. User submits email/password on **Login**.  
2. **`frontend/app/auth/login/page.js`** → **`signInWithEmailAndPassword(auth, email, password)`**.  
3. **`userCredential.user.getIdToken()`** → Firebase ID token.  
4. **`login(idToken)`** in **`api.js`** → **`POST /api/auth/login`** with `{ idToken }`.  
5. **`authController.login`**: **`admin.auth().verifyIdToken(idToken)`**; rejects if **`email_verified`** is false; **`User.findOne({ firebaseUid })`**; loads **`admin.auth().getUser`** for **custom claims** (`role`: `HR` or default `candidate`); if no Mongo user, **creates `User`**; else syncs **`emailVerified`** and **`role`**; **`user.save()`**.  
6. JSON response with **`user`** (uid, email, role, name, …).  
7. Frontend stores **`localStorage.setItem("user", …)`**; redirects **`/hr/dashboard`** if role is HR else **`/candidate/dashboard`**.  
8. Client also checks **`userCredential.user.emailVerified`** and signs out with a toast if false (defense in depth).

**D) Forgot password (as implemented in UI)**

1. User enters email on **`/auth/forgot-password`**.  
2. **`sendPasswordResetEmail(auth, email, actionCodeSettings)`** (Firebase only).  
3. No **`POST /api/auth/forgot-password`** call from this page.  
4. **Backend alternative (unused by this page):** **`authController.forgotPassword`** would call **`generatePasswordResetLink`** via Admin SDK if the client called that endpoint.

**E) Protected routes (session check)**

1. User opens an HR or candidate page wrapped in **`ProtectedRoute`**.  
2. **`onAuthStateChanged`** fires with Firebase user → **`getIdToken()`**.  
3. **`verifyToken(idToken)`** → **`POST /api/auth/verify-token`** with body **`{ token: idToken }`**.  
4. **`authController.verifyToken`**: verify token; **`User.findOne({ firebaseUid: decoded.uid })`**; return **uid, email, role, name, emailVerified**; 404 if no Mongo user.  
5. If **`requiredRole`** does not match, redirect home; else render children.  
6. Interval every 5 minutes re-verifies token.

---

### 3B — Diagram tool prompt (copy-paste)

```
Generate a horizontal data flow diagram with swimlanes: User Browser, Firebase Auth, Next.js Frontend, Express API, MongoDB.

Arrows and labels:

Signup path:
User → Submit signup form → Firebase: createUserWithEmailAndPassword
→ Firebase: updateProfile displayName
→ Firebase: sendEmailVerification email
→ HTTP POST /api/auth/signup → Express authController.signup
→ MongoDB: User.findOne by email (check only)
→ Firebase Admin: getUserByEmail (check only)
→ Response OK → Browser: Firebase signOut → Redirect to Login

Login path:
User → Submit login → Firebase: signInWithEmailAndPassword
→ Browser: getIdToken
→ HTTP POST /api/auth/login { idToken }
→ Express authController.login
→ Firebase Admin: verifyIdToken + getUser (custom claims)
→ MongoDB: User findOne by firebaseUid; create or update User (role, emailVerified)
→ JSON user + role → Browser: localStorage user → Redirect HR dashboard or Candidate dashboard

Forgot password (current UI):
User → Submit email → Firebase Client: sendPasswordResetEmail → User inbox (no backend call)

Protected page:
User → Open /hr or /candidate page
→ Firebase onAuthStateChanged → getIdToken
→ HTTP POST /api/auth/verify-token { token }
→ Express authController.verifyToken
→ MongoDB: User.findOne by firebaseUid
→ JSON role → Allow or block page
```

---

## 4. KEY FRONTEND FUNCTIONS

### `signup` — `frontend/lib/api.js`

**What it does:** POSTs signup payload to backend for duplicate checks / validation (does not create Mongo user).

```javascript
export const signup = async (userData) => {
  try {
    const response = await api.post('/auth/signup', userData);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Signup failed',
    };
  }
};
```

### `login` — `frontend/lib/api.js`

**What it does:** Sends Firebase ID token to backend; returns success + user profile or error.

```javascript
export const login = async (idToken) => {
  try {
    const response = await api.post('/auth/login', { idToken });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Login failed',
    };
  }
};
```

### `verifyEmail` — `frontend/lib/api.js`

**What it does:** Calls `POST /auth/verify-email` with ID token (available for flows that call it; **not imported by any page** in this repo).

```javascript
export const verifyEmail = async (idToken) => {
  try {
    const response = await api.post('/auth/verify-email', { idToken });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to verify email',
    };
  }
};
```

### `forgotPassword` — `frontend/lib/api.js`

**What it does:** Calls backend forgot-password endpoint (**defined** but **forgot-password page uses Firebase client only**, so this may be unused in practice).

```javascript
export const forgotPassword = async (email) => {
  try {
    const response = await api.post('/auth/forgot-password', { email });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to send reset email',
    };
  }
};
```

### `verifyToken` — `frontend/lib/api.js`

**What it does:** Validates session with backend and returns Mongo-backed role for **`ProtectedRoute`**.

```javascript
export const verifyToken = async (idToken) => {
  try {
    const response = await api.post('/auth/verify-token', { token: idToken });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Token verification failed',
    };
  }
};
```

### `onSubmit` (signup) — `frontend/app/auth/signup/page.js`

**What it does:** Full signup pipeline: Firebase user + verification email + backend `signup` + sign out + redirect.

```javascript
  const onSubmit = async (data) => {
    if (data.password !== data.confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    setIsLoading(true)
    try {
      // Step 1: Create user in Firebase using Client SDK
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password
      )

      // Step 2: Update display name in Firebase
      await updateProfile(userCredential.user, {
        displayName: data.name
      })

      // Step 3: Send email verification
      await sendEmailVerification(userCredential.user, {
        url: `${window.location.origin}/auth/login`,
        handleCodeInApp: false,
      })

      // Step 4: Call backend to register user (backend will NOT save to MongoDB yet)
      const result = await signup({
        name: data.name,
        email: data.email,
        password: data.password,
      })

      if (result.success) {
        // Sign out the user since they need to verify email first
        await auth.signOut()
        
        toast.success(
          "Verification email sent! Please check your email and click the verification link to activate your account. You will be redirected to login page.",
          { autoClose: 5000 }
        )
        
        // Redirect to login page after 3 seconds
        setTimeout(() => {
          router.push("/auth/login")
        }, 3000)
      } else {
        // If backend fails, delete the Firebase user
        try {
          await userCredential.user.delete()
        } catch (deleteError) {
          console.error("Error deleting user:", deleteError)
        }
        toast.error(result.error || "Failed to create account. Please try again.")
      }
    } catch (error) {
      console.error("Signup error:", error)
      let errorMessage = "Failed to create account. Please try again."
      if (error.code === "auth/email-already-in-use") {
        errorMessage = "Email is already registered. Please login instead."
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email format. Please check your email address."
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Password is too weak. Please choose a stronger password with at least 8 characters."
      } else if (error.code === "auth/network-request-failed") {
        errorMessage = "Network error. Please check your connection and try again."
      } else if (error.code === "auth/operation-not-allowed") {
        errorMessage = "Account creation is currently disabled. Please contact support."
      }
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }
```

### `onSubmit` (login) — `frontend/app/auth/login/page.js`

**What it does:** Firebase sign-in, token exchange with backend, localStorage, role-based redirect.

```javascript
  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );

      // Get ID token
      const idToken = await userCredential.user.getIdToken();

      // Verify with backend
      const result = await login(idToken);

      if (result.success) {
        // Check if email is verified
        if (!userCredential.user.emailVerified) {
          toast.error("Please verify your email before logging in. Check your inbox for the verification link and click it, then try logging in again.", {
            autoClose: 6000,
          });
          await auth.signOut(); // Sign out unverified user
          return;
        }

        toast.success(result.data.message || "Logged in successfully!");
        
        // Store user data in localStorage (optional)
        localStorage.setItem("user", JSON.stringify(result.data.user));
        
        // Redirect based on user role
        setTimeout(() => {
          if (result.data.user.role === 'HR') {
            router.push("/hr/dashboard");
          } else {
            router.push("/candidate/dashboard");
          }
        }, 1000);
      } else {
        if (result.error && result.error.includes("verify your email")) {
          toast.error(result.error, { autoClose: 6000 });
          await auth.signOut();
        } else {
          toast.error(result.error || "Login failed. Please try again.");
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      let errorMessage = "Invalid email or password. Please try again.";
      if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many failed attempts. Please try again later.";
      } else if (error.code === "auth/network-request-failed") {
        errorMessage = "Network error. Please check your connection and try again.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email format. Please check your email address.";
      }
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
```

### `onSubmit` (forgot password) — `frontend/app/auth/forgot-password/page.js`

**What it does:** Sends reset email through Firebase client SDK only.

```javascript
  const onSubmit = async (data) => {
    setIsLoading(true)
    try {
      const actionCodeSettings = {
        url: `${window.location.origin}/auth/login`,
        handleCodeInApp: false,
      }

      await sendPasswordResetEmail(auth, data.email, actionCodeSettings)

      toast.success("If an account exists with this email, a password reset link has been sent. Please check your inbox and spam folder.")
      reset()
      
      setTimeout(() => {
        router.push("/auth/login")
      }, 3000)
    } catch (error) {
      console.error("Forgot password error:", error)
      
      if (error.code === "auth/user-not-found" || error.code === "auth/invalid-email") {
        toast.success("If an account exists with this email, a password reset link has been sent. Please check your inbox and spam folder.")
        reset()
        setTimeout(() => {
          router.push("/auth/login")
        }, 3000)
        return
      } else if (error.code === "auth/too-many-requests") {
        toast.error("Too many requests. Please try again later.")
      } else {
        toast.error("Failed to send reset link. Please try again.")
      }
    } finally {
      setIsLoading(false)
    }
  }
```

---

## 5. KEY BACKEND FUNCTIONS

### Route wiring — `backend/routes/auth.js`

**What it does:** Maps HTTP paths to `authController` handlers.

```javascript
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/signup', authController.signup);
router.post('/verify-email', authController.verifyEmail);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);

router.post('/verify-token', authController.verifyToken);
router.post('/create-profile', authController.createUserProfile);

module.exports = router;
```

### `exports.signup` — `backend/controllers/authController.js`

**What it does:** Validates signup request; ensures email not already fully registered; does **not** persist to MongoDB.

```javascript
exports.signup = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered. Please login instead.' });
    }

    try {
      const firebaseUser = await admin.auth().getUserByEmail(email);
      if (firebaseUser.emailVerified) {
        return res.status(400).json({ error: 'Email already registered. Please login instead.' });
      }
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    res.status(200).json({
      message: 'User data validated. Please check your email for verification.',
      email: email,
    });
  } catch (error) {
    console.error('Signup validation error:', error);
    res.status(500).json({ error: error.message || 'Failed to validate signup' });
  }
};
```

### `exports.verifyEmail` — `backend/controllers/authController.js`

**What it does:** Verifies ID token, requires `email_verified`, creates or updates **`User`** with role from Firebase custom claims.

```javascript
exports.verifyEmail = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'ID token is required' });
    }

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    if (!decodedToken.email_verified) {
      return res.status(400).json({ error: 'Email is not verified. Please check your email and click the verification link.' });
    }

    let user = await User.findOne({ firebaseUid: decodedToken.uid });
    
    if (user) {
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

    const firebaseUser = await admin.auth().getUser(decodedToken.uid);
    const customClaims = firebaseUser.customClaims || {};
    const userRole = customClaims.role || 'candidate';
    const userName = firebaseUser.displayName || decodedToken.email.split('@')[0] || 'User';
    
    user = new User({
      firebaseUid: decodedToken.uid,
      email: decodedToken.email,
      name: userName,
      role: userRole,
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
```

### `exports.login` — `backend/controllers/authController.js`

**What it does:** Validates token and email verification; finds or creates **`User`**; syncs **`role`** from Firebase custom claims.

```javascript
exports.login = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'ID token is required' });
    }

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    if (!decodedToken.email_verified) {
      return res.status(403).json({ 
        error: 'Please verify your email before logging in. Check your inbox for the verification link.',
        emailVerified: false,
      });
    }
    
    let user = await User.findOne({ firebaseUid: decodedToken.uid });
    const firebaseUser = await admin.auth().getUser(decodedToken.uid);
    const customClaims = firebaseUser.customClaims || {};
    const userRole = customClaims.role || 'candidate';

    if (!user) {
      const firebaseUser = await admin.auth().getUser(decodedToken.uid);
      const userName = firebaseUser.displayName || decodedToken.email.split('@')[0] || 'User';
      user = new User({
        firebaseUid: decodedToken.uid,
        email: decodedToken.email,
        name: userName,
        role: userRole,
        emailVerified: true,
      });
      await user.save();
    } else {
      if (!user.emailVerified) {
        user.emailVerified = true;
      }
      if (customClaims.role && customClaims.role !== user.role) {
        user.role = customClaims.role;
      }
      await user.save();
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
```

### `exports.forgotPassword` — `backend/controllers/authController.js`

**What it does:** Looks up user in Firebase; generates password reset link via Admin SDK (client forgot-password page does not call this).

```javascript
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        return res.json({
          message: 'If an account exists with this email, a password reset link has been sent.',
        });
      }
      throw error;
    }

    const resetLink = await admin.auth().generatePasswordResetLink(email);
    
    res.json({
      message: 'Password reset link sent to your email',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: error.message || 'Failed to send reset email' });
  }
};
```

### `exports.verifyToken` — `backend/controllers/authController.js`

**What it does:** Validates token and returns Mongo **`User`** role for route guards.

```javascript
exports.verifyToken = async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const decoded = await admin.auth().verifyIdToken(token);
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
```

### `exports.createUserProfile` — `backend/controllers/authController.js`

**What it does:** Direct Mongo insert (legacy/helper); **not called** from frontend in this repo.

```javascript
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
```

---

## 6. DATABASE MODEL / SCHEMA

### Full file — `backend/models/User.js`

```javascript
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firebaseUid: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['candidate', 'HR'], default: 'candidate' },
  emailVerified: { type: Boolean, default: false },
}, {
  timestamps: true,
});

module.exports = mongoose.model('User', userSchema);
```

### Most important fields

| Field | Why it matters |
|-------|----------------|
| **`firebaseUid`** | Stable link between MongoDB profile and Firebase Authentication user; used on every token verification. |
| **`email`** | Unique identifier for duplicate checks at signup; human-readable identity. |
| **`role`** | **`candidate`** vs **`HR`** — drives backend `403` checks and frontend redirects after login. Synced from Firebase **custom claims** on login. |
| **`emailVerified`** | Mirrors verified state for app logic; updated when login/verify-email paths run. |
| **`name`** | Display name; seeded from Firebase `displayName` or email local-part. |
| **`timestamps`** | `createdAt` / `updatedAt` automatically maintained by Mongoose. |

---

## 7. API ENDPOINTS USED IN THIS MODULE

Base URL: **`/api/auth`** (from `backend/index.js`).

| Method | Endpoint | Controller function | Purpose |
|--------|----------|---------------------|---------|
| POST | `/api/auth/signup` | `signup` | Validate new registration; check Mongo + Firebase; no Mongo create |
| POST | `/api/auth/verify-email` | `verifyEmail` | Verify ID token + `email_verified`; create/update **`User`** |
| POST | `/api/auth/login` | `login` | Verify ID token + `email_verified`; create/update **`User`**; return role |
| POST | `/api/auth/forgot-password` | `forgotPassword` | Admin SDK reset link generation (**not used by current forgot-password page**) |
| POST | `/api/auth/verify-token` | `verifyToken` | Session check for **`ProtectedRoute`** and API consumers |
| POST | `/api/auth/create-profile` | `createUserProfile` | Direct profile create (**no frontend usage found**) |

**Frontend usage summary:**

- Used: **`signup`**, **`login`**, **`verifyToken`**
- Defined in `api.js` but **not** imported by pages: **`verifyEmail`**, **`forgotPassword`** (reset uses Firebase client instead)

---

## 8. SLIDE-READY SUMMARY

- **Secure by design:** Passwords are handled by **Firebase**, not stored in our database—reducing breach risk and outsourcing industry-standard credential security.  
- **Email-first onboarding:** New users must **verify their email** before the app treats them as fully registered, cutting down on fake or mistyped accounts.  
- **One login, two worlds:** After sign-in, the system reads each user’s **role** and sends **HR** staff and **candidates** to the right dashboard automatically.  
- **Server-backed trust:** Every session is **double-checked** on the server with Firebase Admin so the UI cannot fake being logged in or change roles client-side.  
- **Smooth recovery:** Users who forget their password get a **reset link by email** through Firebase, with messaging that protects privacy (same message whether or not the email exists).  
- **Protected experiences:** Sensitive HR and candidate pages **re-verify** the session periodically so expired or invalid logins are caught gracefully.

---

*End of document.*
