const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const { loggingMiddleware, logInfo, logError } = require('./middleware/logger');
const urlRoutes = require('./routes/urlRoutes');
const { redirectToOriginalUrl } = require('./controllers/urlController');
const { formatErrorResponse } = require('./utils/helpers');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
}));

// Compression middleware
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: true,
    message: 'Too many requests from this IP, please try again later.',
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Trust proxy for correct IP addresses
app.set('trust proxy', 1);

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Custom logging middleware
app.use(loggingMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
  logInfo('Health check endpoint accessed', {
    requestId: req.requestId,
    timestamp: new Date().toISOString()
  });
  
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api', urlRoutes);

// Shortcode redirect route (this must come after API routes)
app.get('/:shortcode', (req, res, next) => {
  // Skip if this looks like a static file request
  const shortcode = req.params.shortcode;
  if (shortcode.includes('.') || shortcode === 'favicon.ico') {
    return next();
  }
  
  logInfo('Shortcode redirect route accessed', {
    requestId: req.requestId,
    shortcode
  });
  
  redirectToOriginalUrl(req, res, next);
});

// Static file serving (if needed)
app.use(express.static(path.join(__dirname, 'public')));

// 404 handler for unknown routes
app.use('*', (req, res) => {
  logError('404 Not Found', {
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    ip: req.ip
  });
  
  res.status(404).json(formatErrorResponse('Route not found'));
});

// Global error handler
app.use((error, req, res, next) => {
  logError('Global error handler triggered', {
    requestId: req.requestId,
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method
  });

  // Handle specific error types
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json(formatErrorResponse('Invalid JSON in request body'));
  }

  if (error.type === 'entity.too.large') {
    return res.status(413).json(formatErrorResponse('Request body too large'));
  }

  // Default error response
  res.status(500).json(formatErrorResponse('Internal server error'));
});

// Start server
const server = app.listen(PORT, () => {
  logInfo('Server started successfully', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
  console.log(`🚀 URL Shortener Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logInfo('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logInfo('Server shut down completed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logInfo('SIGINT received, shutting down gracefully');
  server.close(() => {
    logInfo('Server shut down completed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logError('Uncaught Exception', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logError('Unhandled Rejection', {
    reason: reason.toString(),
    promise: promise.toString()
  });
  process.exit(1);
});

module.exports = app;
