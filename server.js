require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
const config = require('./config/config');
const logger = require('./utils/logger');

// Database connection test
const db = require('./config/db');
db.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('DATABASE CONNECTION ERROR:', err);
  } else {
    console.log('DATABASE CONNECTION SUCCESSFUL:', res.rows[0]);
  }
});

const app = express();

app.use(express.json({ extended: false }));
app.use(cors({
  origin: config.CORS_ORIGIN,
  credentials: true
}));

app.use(morgan('combined', { stream: logger.stream }));

app.use((req, res, next) => {
  req.startTime = Date.now();
  res.on('finish', () => {
    const responseTime = Date.now() - req.startTime;
    logger.request(req, res, responseTime);
  });
  next();
});

// API Routes
app.use('/api/users', require('./routes/api/users'));
app.use('/api/auth', require('./routes/api/auth'));
app.use('/api/conversations', require('./routes/api/conversations'));
app.use('/api/insights', require('./routes/api/insights'));
app.use('/api/personas', require('./routes/api/personas'));
app.use('/api/ai', require('./routes/api/ai'));

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('client/build'));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
  });
} else {
  // Development route for root path
  app.get('/', (req, res) => {
    res.json({ msg: 'Welcome to Numira API' });
  });
}

const PORT = config.PORT || 5000;
app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT} in ${config.NODE_ENV} mode`);
});

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});