const db = require('../models/database');
const { logInfo, logError } = require('../middleware/logger');
const {
  generateShortcode,
  isValidShortcode,
  isValidUrl,
  isValidValidity,
  calculateExpirationDate,
  isExpired,
  getGeographicalInfo,
  parseUserAgent,
  formatErrorResponse,
  formatSuccessResponse
} = require('../utils/helpers');

// Create a new short URL
const createShortUrl = async (req, res) => {
  try {
    const { url, validity, shortcode } = req.body;

    logInfo('Create short URL request received', {
      requestId: req.requestId,
      url,
      validity,
      shortcode,
      ip: req.ip
    });

    // Validate required fields
    if (!url) {
      logError('URL creation failed: missing URL', {
        requestId: req.requestId
      });
      return res.status(400).json(formatErrorResponse('URL is required'));
    }

    // Validate URL format
    if (!isValidUrl(url)) {
      logError('URL creation failed: invalid URL format', {
        requestId: req.requestId,
        url
      });
      return res.status(400).json(formatErrorResponse('Invalid URL format. URL must start with http:// or https://'));
    }

    // Validate validity period
    if (validity !== undefined && !isValidValidity(validity)) {
      logError('URL creation failed: invalid validity period', {
        requestId: req.requestId,
        validity
      });
      return res.status(400).json(formatErrorResponse('Validity must be a positive integer (minutes)'));
    }

    // Validate custom shortcode if provided
    if (shortcode && !isValidShortcode(shortcode)) {
      logError('URL creation failed: invalid shortcode', {
        requestId: req.requestId,
        shortcode
      });
      return res.status(400).json(formatErrorResponse('Invalid shortcode. Must be alphanumeric, 3-20 characters, and not a reserved word'));
    }

    // Check if custom shortcode already exists
    if (shortcode && db.shortcodeExists(shortcode)) {
      logError('URL creation failed: shortcode already exists', {
        requestId: req.requestId,
        shortcode
      });
      return res.status(409).json(formatErrorResponse('Shortcode already exists. Please choose a different one'));
    }

    // Generate shortcode if not provided
    let finalShortcode = shortcode;
    if (!finalShortcode) {
      do {
        finalShortcode = generateShortcode();
      } while (db.shortcodeExists(finalShortcode));
    }

    // Calculate expiration date
    const validityMinutes = validity || 30; // Default 30 minutes
    const expirationDate = calculateExpirationDate(validityMinutes);

    // Create URL data
    const urlData = {
      originalUrl: url,
      shortcode: finalShortcode,
      expiresAt: expirationDate,
      createdBy: req.ip,
      userAgent: req.get('User-Agent')
    };

    // Save to database
    const saved = db.saveUrl(finalShortcode, urlData);
    
    if (!saved) {
      logError('URL creation failed: database error', {
        requestId: req.requestId,
        shortcode: finalShortcode
      });
      return res.status(500).json(formatErrorResponse('Failed to create short URL'));
    }

    // Prepare response
    const baseUrl = process.env.BASE_URL || `http://localhost:5000`;
    const shortLink = `${baseUrl}/${finalShortcode}`;

    const response = {
      shortLink,
      expiry: expirationDate.toISOString()
    };

    logInfo('Short URL created successfully', {
      requestId: req.requestId,
      shortcode: finalShortcode,
      originalUrl: url,
      shortLink,
      expiresAt: expirationDate
    });

    res.status(201).json(response);

  } catch (error) {
    logError('Unexpected error in createShortUrl', {
      requestId: req.requestId,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json(formatErrorResponse('Internal server error'));
  }
};

// Get statistics for a short URL
const getShortUrlStats = async (req, res) => {
  try {
    const { shortcode } = req.params;

    logInfo('Get short URL stats request received', {
      requestId: req.requestId,
      shortcode,
      ip: req.ip
    });

    // Validate shortcode
    if (!shortcode) {
      logError('Stats retrieval failed: missing shortcode', {
        requestId: req.requestId
      });
      return res.status(400).json(formatErrorResponse('Shortcode is required'));
    }

    // Get statistics from database
    const stats = db.getClickStats(shortcode);

    if (!stats) {
      logError('Stats retrieval failed: shortcode not found', {
        requestId: req.requestId,
        shortcode
      });
      return res.status(404).json(formatErrorResponse('Short URL not found'));
    }

    // Check if URL is expired
    if (isExpired(stats.expiresAt)) {
      logInfo('Stats retrieved for expired URL', {
        requestId: req.requestId,
        shortcode,
        expiresAt: stats.expiresAt
      });
    }

    const response = {
      shortcode: stats.shortcode,
      originalUrl: stats.originalUrl,
      createdAt: stats.createdAt,
      expiresAt: stats.expiresAt,
      totalClicks: stats.totalClicks,
      isExpired: isExpired(stats.expiresAt),
      clicks: stats.clicks.map(click => ({
        timestamp: click.timestamp,
        source: {
          referrer: click.referrer || 'Direct',
          userAgent: click.userAgent,
          browser: click.browser,
          os: click.os
        },
        location: {
          country: click.location.country,
          region: click.location.region,
          city: click.location.city,
          coordinates: click.location.coordinates
        }
      }))
    };

    logInfo('Short URL stats retrieved successfully', {
      requestId: req.requestId,
      shortcode,
      totalClicks: stats.totalClicks
    });

    res.status(200).json(response);

  } catch (error) {
    logError('Unexpected error in getShortUrlStats', {
      requestId: req.requestId,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json(formatErrorResponse('Internal server error'));
  }
};

// Redirect to original URL
const redirectToOriginalUrl = async (req, res) => {
  try {
    const { shortcode } = req.params;

    logInfo('Redirect request received', {
      requestId: req.requestId,
      shortcode,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      referrer: req.get('Referrer')
    });

    // Get URL data
    const urlData = db.getUrl(shortcode);

    if (!urlData) {
      logError('Redirect failed: shortcode not found', {
        requestId: req.requestId,
        shortcode
      });
      return res.status(404).json(formatErrorResponse('Short URL not found'));
    }

    // Check if URL is expired
    if (isExpired(urlData.expiresAt)) {
      logError('Redirect failed: URL expired', {
        requestId: req.requestId,
        shortcode,
        expiresAt: urlData.expiresAt
      });
      return res.status(410).json(formatErrorResponse('Short URL has expired'));
    }

    // Record click analytics
    const clientIp = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    const referrer = req.get('Referrer');
    
    const clickData = {
      ip: clientIp,
      userAgent,
      referrer,
      location: getGeographicalInfo(clientIp),
      ...parseUserAgent(userAgent)
    };

    db.recordClick(shortcode, clickData);

    logInfo('Redirecting to original URL', {
      requestId: req.requestId,
      shortcode,
      originalUrl: urlData.originalUrl,
      clickRecorded: true
    });

    // Redirect to original URL
    res.redirect(urlData.originalUrl);

  } catch (error) {
    logError('Unexpected error in redirectToOriginalUrl', {
      requestId: req.requestId,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json(formatErrorResponse('Internal server error'));
  }
};

// Get all URLs (for frontend)
const getAllUrls = async (req, res) => {
  try {
    logInfo('Get all URLs request received', {
      requestId: req.requestId,
      ip: req.ip
    });

    const allUrls = db.getAllUrls();

    logInfo('All URLs retrieved successfully', {
      requestId: req.requestId,
      count: allUrls.length
    });

    res.status(200).json(formatSuccessResponse(allUrls));

  } catch (error) {
    logError('Unexpected error in getAllUrls', {
      requestId: req.requestId,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json(formatErrorResponse('Internal server error'));
  }
};

module.exports = {
  createShortUrl,
  getShortUrlStats,
  redirectToOriginalUrl,
  getAllUrls
};
