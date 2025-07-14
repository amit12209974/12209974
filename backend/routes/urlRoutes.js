const express = require('express');
const router = express.Router();
const {
  createShortUrl,
  getShortUrlStats,
  getAllUrls
} = require('../controllers/urlController');
const { logInfo } = require('../middleware/logger');

// Create short URL
router.post('/shorturls', (req, res, next) => {
  logInfo('POST /shorturls route accessed', {
    requestId: req.requestId,
    body: req.body
  });
  createShortUrl(req, res, next);
});

// Get short URL statistics
router.get('/shorturls/:shortcode', (req, res, next) => {
  logInfo('GET /shorturls/:shortcode route accessed', {
    requestId: req.requestId,
    shortcode: req.params.shortcode
  });
  getShortUrlStats(req, res, next);
});

// Get all URLs (for frontend)
router.get('/shorturls', (req, res, next) => {
  logInfo('GET /shorturls route accessed', {
    requestId: req.requestId
  });
  getAllUrls(req, res, next);
});

module.exports = router;
