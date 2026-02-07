const admin = require("firebase-admin");

if (!admin.apps.length) {
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      credential = admin.credential.cert(serviceAccount);
    } catch (e) {
      console.error("Invalid FIREBASE_SERVICE_ACCOUNT_JSON:", e.message);
    }
  }
  if (!credential) {
    try {
      const serviceAccount = require("../../neurohire-c4e9f-firebase-adminsdk-fbsvc-a256ef5366.json");
      credential = admin.credential.cert(serviceAccount);
    } catch (e) {
      console.warn("Firebase: no service account file or FIREBASE_SERVICE_ACCOUNT_JSON");
    }
  }
  if (credential) {
    admin.initializeApp({ credential });
  }
}

module.exports = admin;
