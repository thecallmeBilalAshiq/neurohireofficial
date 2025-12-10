const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const jobPostRoutes = require('./routes/jobPosts');
const llmRoutes = require('./routes/llm');
const socialMediaRoutes = require('./routes/socialMedia');
const aiImageRoutes = require('./routes/aiImage');
const applicationRoutes = require('./routes/applications');
const cvRoutes = require('./routes/cv');

dotenv.config();

// connect database
connectDB();

const app = express();
app.use(cors({ origin: 'http://localhost:3000' })); // Update to your frontend URL later

// Only parse JSON for non-multipart requests
app.use((req, res, next) => {
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    return next(); // Skip JSON parsing for multipart requests
  }
  express.json()(req, res, next);
});

// Create uploads directory if it doesn't exist
const fs = require('fs');
const uploadsDir = 'uploads/cvs';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use('/api/auth', authRoutes);
app.use('/api/job-posts', jobPostRoutes);
app.use('/api/llm', llmRoutes);
app.use('/api/social-media', socialMediaRoutes);
app.use('/api/ai-image', aiImageRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/cv', cvRoutes);


// Health check endpoint
app.get('/', (req, res) => {
  res.send('Backend running');
});

// Debug endpoint to check if routes are registered
app.get('/api/debug/routes', (req, res) => {
  const routes = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods),
      });
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          routes.push({
            path: handler.route.path,
            methods: Object.keys(handler.route.methods),
          });
        }
      });
    }
  });
  res.json({ routes });
});


// 404 handler for undefined routes (must be last)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    console.log(`[404] API route not found: ${req.method} ${req.originalUrl}`);
  }
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server on port ${PORT}`));