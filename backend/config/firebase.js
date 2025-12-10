const admin = require("firebase-admin");
const serviceAccount = require("../../neurohire-c4e9f-firebase-adminsdk-fbsvc-a256ef5366.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

module.exports = admin;
