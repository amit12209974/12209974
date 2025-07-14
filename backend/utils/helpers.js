const { logInfo, logError } = require('../middleware/logger');
const geoip = require('geoip-lite');

// Generate a random shortcode
function generateShortcode(length = 6) {
  const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  
  logInfo('Shortcode generated', {
    shortcode: result,
    length
  });
  
  return result;
}

// Validate shortcode format
function isValidShortcode(shortcode) {
  if (!shortcode || typeof shortcode !== 'string') {
    logInfo('Shortcode validation failed: invalid type', {
      shortcode,
      type: typeof shortcode
    });
    return false;
  }
  
  // Check length (between 3 and 20 characters)
  if (shortcode.length < 3 || shortcode.length > 20) {
    logInfo('Shortcode validation failed: invalid length', {
      shortcode,
      length: shortcode.length
    });
    return false;
  }
  
  // Check if alphanumeric only
  const alphanumericRegex = /^[a-zA-Z0-9]+$/;
  if (!alphanumericRegex.test(shortcode)) {
    logInfo('Shortcode validation failed: not alphanumeric', {
      shortcode
    });
    return false;
  }
  
  // Check for reserved words
  const reservedWords = ['api', 'admin', 'www', 'shorturls', 'stats', 'analytics'];
  if (reservedWords.includes(shortcode.toLowerCase())) {
    logInfo('Shortcode validation failed: reserved word', {
      shortcode
    });
    return false;
  }
  
  logInfo('Shortcode validation passed', {
    shortcode
  });
  
  return true;
}

// Validate URL format
function isValidUrl(url) {
  try {
    const urlObject = new URL(url);
    const isValid = urlObject.protocol === 'http:' || urlObject.protocol === 'https:';
    
    logInfo('URL validation', {
      url,
      isValid,
      protocol: urlObject.protocol
    });
    
    return isValid;
  } catch (error) {
    logError('URL validation failed', {
      url,
      error: error.message
    });
    return false;
  }
}

// Validate validity period (in minutes)
function isValidValidity(validity) {
  if (validity === undefined || validity === null) {
    return true; // Optional parameter
  }
  
  const isValid = Number.isInteger(validity) && validity > 0 && validity <= 525600; // Max 1 year
  
  logInfo('Validity validation', {
    validity,
    isValid
  });
  
  return isValid;
}

// Calculate expiration date
function calculateExpirationDate(validityMinutes = 30) {
  const expirationDate = new Date();
  expirationDate.setMinutes(expirationDate.getMinutes() + validityMinutes);
  
  logInfo('Expiration date calculated', {
    validityMinutes,
    expirationDate
  });
  
  return expirationDate;
}

// Check if URL is expired
function isExpired(expirationDate) {
  const now = new Date();
  const expired = new Date(expirationDate) < now;
  
  logInfo('Expiration check', {
    expirationDate,
    now,
    expired
  });
  
  return expired;
}

// Extract geographical information from IP
function getGeographicalInfo(ip) {
  try {
    // Handle localhost and local IPs
    if (ip === '127.0.0.1' || ip === '::1' || ip.includes('192.168.') || ip.includes('10.0.')) {
      logInfo('Local IP detected, using default location', {
        ip
      });
      return {
        country: 'Unknown',
        region: 'Unknown',
        city: 'Unknown',
        coordinates: null
      };
    }
    
    const geo = geoip.lookup(ip);
    
    if (geo) {
      const locationInfo = {
        country: geo.country || 'Unknown',
        region: geo.region || 'Unknown',
        city: geo.city || 'Unknown',
        coordinates: geo.ll || null
      };
      
      logInfo('Geographical information extracted', {
        ip,
        location: locationInfo
      });
      
      return locationInfo;
    } else {
      logInfo('No geographical information found for IP', {
        ip
      });
      return {
        country: 'Unknown',
        region: 'Unknown',
        city: 'Unknown',
        coordinates: null
      };
    }
  } catch (error) {
    logError('Failed to extract geographical information', {
      ip,
      error: error.message
    });
    return {
      country: 'Unknown',
      region: 'Unknown',
      city: 'Unknown',
      coordinates: null
    };
  }
}

// Parse User-Agent to extract browser and OS info
function parseUserAgent(userAgent) {
  try {
    // Simple user agent parsing (in production, use a proper library like 'ua-parser-js')
    let browser = 'Unknown';
    let os = 'Unknown';
    
    if (userAgent) {
      // Browser detection
      if (userAgent.includes('Chrome')) browser = 'Chrome';
      else if (userAgent.includes('Firefox')) browser = 'Firefox';
      else if (userAgent.includes('Safari')) browser = 'Safari';
      else if (userAgent.includes('Edge')) browser = 'Edge';
      else if (userAgent.includes('Opera')) browser = 'Opera';
      
      // OS detection
      if (userAgent.includes('Windows')) os = 'Windows';
      else if (userAgent.includes('Mac')) os = 'macOS';
      else if (userAgent.includes('Linux')) os = 'Linux';
      else if (userAgent.includes('Android')) os = 'Android';
      else if (userAgent.includes('iOS')) os = 'iOS';
    }
    
    const result = { browser, os };
    
    logInfo('User agent parsed', {
      userAgent,
      parsed: result
    });
    
    return result;
  } catch (error) {
    logError('Failed to parse user agent', {
      userAgent,
      error: error.message
    });
    return { browser: 'Unknown', os: 'Unknown' };
  }
}

// Format error response
function formatErrorResponse(message, details = {}) {
  const errorResponse = {
    error: true,
    message,
    timestamp: new Date().toISOString(),
    ...details
  };
  
  logError('Error response formatted', {
    message,
    details
  });
  
  return errorResponse;
}

// Format success response
function formatSuccessResponse(data, message = 'Success') {
  const successResponse = {
    error: false,
    message,
    timestamp: new Date().toISOString(),
    data
  };
  
  logInfo('Success response formatted', {
    message,
    hasData: !!data
  });
  
  return successResponse;
}

module.exports = {
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
};
