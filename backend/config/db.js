const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();


const connectDB = async () => {
  const uri = (process.env.MONGO_URI || '').trim();
  if (!uri) {
    console.error('MONGO_URI is missing or empty in backend/.env');
    console.error('  Local: mongodb://localhost:27017/neurohire');
    console.error('  Atlas: mongodb+srv://f223873:YOUR_PASSWORD@neurohire.nftaz6m.mongodb.net/neurohire?appName=NeuroHire&retryWrites=true&w=majority');
    process.exit(1);
  }
  const isMongoUri = uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://');
  if (!isMongoUri || uri === '5000' || uri === process.env.PORT) {
    console.error('MONGO_URI must be a MongoDB connection string, not a number or port.');
    console.error('  Current value looks wrong: "' + (uri.length > 40 ? uri.substring(0, 40) + '...' : uri) + '"');
    console.error('  In backend/.env set MONGO_URI to your Atlas URI, e.g.:');
    console.error('  MONGO_URI=mongodb+srv://f223873:YOUR_PASSWORD@neurohire.nftaz6m.mongodb.net/neurohire?appName=NeuroHire&retryWrites=true&w=majority');
    process.exit(1);
  }
  try {
    await mongoose.connect(uri);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err && err.message ? err.message : err);
    // Print more details for Atlas troubleshooting (DNS, TLS, auth, replica set, etc.)
    if (err && typeof err === 'object') {
      const details = {
        name: err.name,
        code: err.code,
        errno: err.errno,
        syscall: err.syscall,
        hostname: err.hostname,
        reason: err.reason,
        cause: err.cause,
      };
      console.error('MongoDB connection error details:', JSON.stringify(details, null, 2));
    }
    process.exit(1);
  }
};

module.exports = connectDB;
