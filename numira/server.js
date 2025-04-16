const express = require('express');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
const config = require('./config/config');
const logger = require('./utils/logger');
const connectDB = require('./config/db');

// Initialize Express
const app = express();

// Connect to Database
connectDB();

// Middleware
app.use(express.json({ extended: false }));
app.use(cors({
  origin: config.CORS_ORIGIN,
  credentials: true
}));

// Request logging
app.use(morgan('combined', { stream: logger.stream }));

// Response time tracking middleware
app.use((req, res, next) => {
  req.startTime = Date.now();
  
  // Log response time on completion
  res.on('finish', () => {
    const responseTime = Date.now() - req.startTime;
    logger.request(req, res, responseTime);
  });
  
  next();
});

// Define Routes
app.use('/api/users', require('./routes/api/users'));
app.use('/api/auth', require('./routes/api/auth'));
app.use('/api/conversations', require('./routes/api/conversations'));
app.use('/api/insights', require('./routes/api/insights'));
app.use('/api/personas', require('./routes/api/personas'));
app.use('/api/ai', require('./routes/api/ai'));

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  // Set static folder
  app.use(express.static('client/build'));

  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
  });
}

const PORT = config.PORT || 5000;

app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT} in ${config.NODE_ENV} mode`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  // Close server & exit process
  process.exit(1);
});
