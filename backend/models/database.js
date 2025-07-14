// In-memory database simulation for this evaluation
// In production, this would be replaced with a proper database like MongoDB or PostgreSQL

const { logInfo, logError } = require('../middleware/logger');

class InMemoryDB {
  constructor() {
    this.urls = new Map(); // shortcode -> url data
    this.clicks = new Map(); // shortcode -> array of click data
  }

  // Save a new shortened URL
  saveUrl(shortcode, urlData) {
    try {
      this.urls.set(shortcode, {
        ...urlData,
        createdAt: new Date(),
        id: shortcode
      });
      this.clicks.set(shortcode, []);
      
      logInfo('URL saved to database', {
        shortcode,
        originalUrl: urlData.originalUrl,
        expiresAt: urlData.expiresAt
      });
      
      return true;
    } catch (error) {
      logError('Failed to save URL to database', {
        shortcode,
        error: error.message
      });
      return false;
    }
  }

  // Get URL data by shortcode
  getUrl(shortcode) {
    try {
      const urlData = this.urls.get(shortcode);
      
      if (urlData) {
        logInfo('URL retrieved from database', {
          shortcode,
          found: true
        });
      } else {
        logInfo('URL not found in database', {
          shortcode,
          found: false
        });
      }
      
      return urlData;
    } catch (error) {
      logError('Failed to retrieve URL from database', {
        shortcode,
        error: error.message
      });
      return null;
    }
  }

  // Check if shortcode exists
  shortcodeExists(shortcode) {
    const exists = this.urls.has(shortcode);
    logInfo('Shortcode existence check', {
      shortcode,
      exists
    });
    return exists;
  }

  // Record a click
  recordClick(shortcode, clickData) {
    try {
      const clicks = this.clicks.get(shortcode) || [];
      clicks.push({
        ...clickData,
        timestamp: new Date(),
        id: require('uuid').v4()
      });
      this.clicks.set(shortcode, clicks);
      
      logInfo('Click recorded', {
        shortcode,
        clickData: {
          ip: clickData.ip,
          userAgent: clickData.userAgent,
          referrer: clickData.referrer,
          location: clickData.location
        }
      });
      
      return true;
    } catch (error) {
      logError('Failed to record click', {
        shortcode,
        error: error.message
      });
      return false;
    }
  }

  // Get click statistics
  getClickStats(shortcode) {
    try {
      const clicks = this.clicks.get(shortcode) || [];
      const urlData = this.urls.get(shortcode);
      
      if (!urlData) {
        logInfo('Click stats requested for non-existent URL', {
          shortcode
        });
        return null;
      }

      const stats = {
        shortcode,
        originalUrl: urlData.originalUrl,
        createdAt: urlData.createdAt,
        expiresAt: urlData.expiresAt,
        totalClicks: clicks.length,
        clicks: clicks.map(click => ({
          timestamp: click.timestamp,
          ip: click.ip,
          userAgent: click.userAgent,
          referrer: click.referrer,
          location: click.location
        }))
      };

      logInfo('Click statistics retrieved', {
        shortcode,
        totalClicks: stats.totalClicks
      });

      return stats;
    } catch (error) {
      logError('Failed to retrieve click statistics', {
        shortcode,
        error: error.message
      });
      return null;
    }
  }

  // Get all URLs (for frontend display)
  getAllUrls() {
    try {
      const allUrls = [];
      
      for (const [shortcode, urlData] of this.urls.entries()) {
        const clicks = this.clicks.get(shortcode) || [];
        allUrls.push({
          shortcode,
          originalUrl: urlData.originalUrl,
          createdAt: urlData.createdAt,
          expiresAt: urlData.expiresAt,
          totalClicks: clicks.length,
          shortLink: `${process.env.BASE_URL || 'http://localhost:5000'}/${shortcode}`
        });
      }

      logInfo('All URLs retrieved', {
        count: allUrls.length
      });

      return allUrls;
    } catch (error) {
      logError('Failed to retrieve all URLs', {
        error: error.message
      });
      return [];
    }
  }

  // Clean expired URLs (utility method)
  cleanExpiredUrls() {
    try {
      const now = new Date();
      let cleanedCount = 0;

      for (const [shortcode, urlData] of this.urls.entries()) {
        if (urlData.expiresAt && new Date(urlData.expiresAt) < now) {
          this.urls.delete(shortcode);
          this.clicks.delete(shortcode);
          cleanedCount++;
        }
      }

      logInfo('Expired URLs cleaned', {
        cleanedCount
      });

      return cleanedCount;
    } catch (error) {
      logError('Failed to clean expired URLs', {
        error: error.message
      });
      return 0;
    }
  }
}

// Create singleton instance
const db = new InMemoryDB();

module.exports = db;
