/**
 * Local development server for testing serverless functions
 */
const express = require('express');
const cors = require('cors');
const { handler } = require('./index');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.raw());

// Convert Express request to Scaleway function event format
function createEvent(req) {
  return {
    httpMethod: req.method,
    path: req.path,
    headers: req.headers,
    body: req.body ? JSON.stringify(req.body) : null,
    queryStringParameters: req.query
  };
}

// Handle all routes
app.all('*', async (req, res) => {
  try {
    const event = createEvent(req);
    const context = {}; // Mock context
    
    const result = await handler(event, context);
    
    // Set headers
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        res.set(key, value);
      });
    }
    
    // Send response
    res.status(result.statusCode || 200);
    
    if (result.body) {
      try {
        // Try to parse as JSON for pretty printing
        const jsonBody = JSON.parse(result.body);
        res.json(jsonBody);
      } catch {
        // Send as text if not JSON
        res.send(result.body);
      }
    } else {
      res.end();
    }
    
  } catch (error) {
    console.error('Function error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Local development server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET  /api/health     - Health check');
  console.log('  GET  /api/events     - Get events');
  console.log('  POST /api/events     - Save events');
  console.log('  GET  /api/tasks      - Get tasks');
  console.log('  POST /api/tasks      - Save tasks');
  console.log('  GET  /api/analytics  - Get analytics');
  console.log('  GET  /api/backup     - Export data');
  console.log('  POST /api/backup     - Import data');
});