const dotenv = require("dotenv");
dotenv.config();

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

function resolveCredentialPath(envPath) {
  if (!envPath) return null;
  if (path.isAbsolute(envPath)) return envPath;
  return path.resolve(process.cwd(), envPath);
}

function loadServiceAccount() {
  // Check if credentials are provided directly as JSON string in env variables
  const directJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (directJson && directJson.trim().startsWith('{')) {
    try {
      return JSON.parse(directJson);
    } catch (e) {
      console.error("Failed to parse Firebase service account JSON string:", e.message);
    }
  }

  // Otherwise, treat as a path
  const envPath = resolveCredentialPath(
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    (process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.FIREBASE_SERVICE_ACCOUNT.trim().startsWith('{') ? process.env.FIREBASE_SERVICE_ACCOUNT : null)
  );
  if (envPath && fs.existsSync(envPath)) {
    return JSON.parse(fs.readFileSync(envPath, "utf8"));
  }

  const projectRoot = path.join(__dirname, "../..");
  const defaultCandidates = fs
    .readdirSync(projectRoot)
    .filter((name) => name.includes("firebase-adminsdk") && name.endsWith(".json"))
    .map((name) => path.join(projectRoot, name));

  for (const candidate of defaultCandidates) {
    if (fs.existsSync(candidate)) {
      return JSON.parse(fs.readFileSync(candidate, "utf8"));
    }
  }

  return null;
}

async function verifyFirebaseCredentials() {
  try {
    await admin.auth().listUsers(1);
    console.log("Firebase Admin credentials verified");
  } catch (error) {
    console.error("\nFirebase Admin credential check failed:");
    console.error(error.message);
    console.error(
      "\nFix: generate a new service account key at\n" +
      "https://console.firebase.google.com/project/neurohire-c4e9f/settings/serviceaccounts/adminsdk\n" +
      "Then set FIREBASE_SERVICE_ACCOUNT_PATH in backend/.env or replace the JSON file in the project root.\n" +
      "Also sync Windows time: Settings > Time & language > Date & time > Sync now.\n"
    );
  }
}

if (!admin.apps.length) {
  let credential;
  try {
    const serviceAccount = loadServiceAccount();
    if (serviceAccount) {
      credential = admin.credential.cert(serviceAccount);
    }
  } catch (e) {
    console.error("Failed to load Firebase service account:", e.message);
  }

  if (credential) {
    admin.initializeApp({ credential });
    verifyFirebaseCredentials();
  } else {
    console.warn("Firebase Admin not initialized: no service account found");
  }
}

module.exports = admin;
