import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import taskRoutes from './routes/tasks';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors({
  origin: '*', // Allow all origins for simplicity in deployment, or specify frontend URL
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', projectRoutes);
app.use('/api', taskRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend static files in production
const frontendDistPath = __dirname.includes('dist')
  ? path.join(__dirname, '../../../frontend/dist')
  : path.join(__dirname, '../../frontend/dist');

app.use(express.static(frontendDistPath));

// For SPA routing fallback to index.html
app.get('*', (req, res, next) => {
  // If it starts with /api, pass it to Express router (404 will be handled naturally or by router)
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(frontendDistPath, 'index.html'), (err) => {
    if (err) {
      // In development or if frontend is not built, index.html won't exist
      res.status(404).send('API is running. Frontend static files not built yet.');
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Production frontend static path: ${frontendDistPath}`);
});
