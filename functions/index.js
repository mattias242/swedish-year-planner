/**
 * Scaleway Serverless Function for Swedish Year Planner
 * Handles API endpoints for data persistence and analytics
 */

const cors = require('cors');

// CORS configuration for frontend
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:8080',
    'https://swedish-year-planner.s3.fr-par.scw.cloud',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-ID'],
  credentials: true
};

// Simple in-memory storage (replace with Scaleway Database or Redis in production)
const storage = new Map();

/**
 * Main handler function for Scaleway Serverless Functions
 */
exports.handler = async (event, context) => {
  const { httpMethod, path, headers, body, queryStringParameters } = event;
  
  // Apply CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': corsOptions.origin.includes(headers.origin) ? headers.origin : corsOptions.origin[0],
    'Access-Control-Allow-Methods': corsOptions.methods.join(', '),
    'Access-Control-Allow-Headers': corsOptions.allowedHeaders.join(', '),
    'Access-Control-Allow-Credentials': 'true'
  };

  // Handle preflight requests
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  try {
    let response;
    
    switch (path) {
      case '/api/health':
        response = handleHealth();
        break;
      case '/api/events':
        response = await handleEvents(httpMethod, body, queryStringParameters, headers);
        break;
      case '/api/tasks':
        response = await handleTasks(httpMethod, body, queryStringParameters, headers);
        break;
      case '/api/analytics':
        response = await handleAnalytics(httpMethod, queryStringParameters, headers);
        break;
      case '/api/backup':
        response = await handleBackup(httpMethod, body, headers);
        break;
      default:
        response = {
          statusCode: 404,
          body: JSON.stringify({ error: 'Endpoint not found' })
        };
    }

    return {
      ...response,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        ...response.headers
      }
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};

/**
 * Health check endpoint
 */
function handleHealth() {
  return {
    statusCode: 200,
    body: JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'production'
    })
  };
}

/**
 * Handle events API
 */
async function handleEvents(method, body, query, headers) {
  const userId = headers['x-user-id'] || 'anonymous';
  const userKey = `events_${userId}`;

  switch (method) {
    case 'GET':
      const events = storage.get(userKey) || [];
      return {
        statusCode: 200,
        body: JSON.stringify(events)
      };

    case 'POST':
      const newEvents = JSON.parse(body || '[]');
      storage.set(userKey, newEvents);
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, count: newEvents.length })
      };

    default:
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
  }
}

/**
 * Handle tasks API
 */
async function handleTasks(method, body, query, headers) {
  const userId = headers['x-user-id'] || 'anonymous';
  const userKey = `tasks_${userId}`;

  switch (method) {
    case 'GET':
      const tasks = storage.get(userKey) || [];
      return {
        statusCode: 200,
        body: JSON.stringify(tasks)
      };

    case 'POST':
      const newTasks = JSON.parse(body || '[]');
      storage.set(userKey, newTasks);
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, count: newTasks.length })
      };

    default:
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
  }
}

/**
 * Handle analytics API
 */
async function handleAnalytics(method, query, headers) {
  if (method !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const userId = headers['x-user-id'] || 'anonymous';
  const events = storage.get(`events_${userId}`) || [];
  const tasks = storage.get(`tasks_${userId}`) || [];

  const analytics = {
    totalEvents: events.length,
    totalTasks: tasks.length,
    completedTasks: tasks.filter(task => isTaskCompleted(task)).length,
    recurringEvents: events.filter(event => event.recurring !== false).length,
    recurringTasks: tasks.filter(task => task.recurring !== false).length,
    lastUpdated: new Date().toISOString()
  };

  return {
    statusCode: 200,
    body: JSON.stringify(analytics)
  };
}

/**
 * Handle backup/export API
 */
async function handleBackup(method, body, headers) {
  const userId = headers['x-user-id'] || 'anonymous';

  switch (method) {
    case 'GET':
      // Export user data
      const events = storage.get(`events_${userId}`) || [];
      const tasks = storage.get(`tasks_${userId}`) || [];
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          version: '1.0.0',
          exportDate: new Date().toISOString(),
          data: { events, tasks }
        }),
        headers: {
          'Content-Disposition': `attachment; filename="year-planner-backup-${new Date().toISOString().split('T')[0]}.json"`
        }
      };

    case 'POST':
      // Import user data
      const backupData = JSON.parse(body);
      if (backupData.data) {
        if (backupData.data.events) {
          storage.set(`events_${userId}`, backupData.data.events);
        }
        if (backupData.data.tasks) {
          storage.set(`tasks_${userId}`, backupData.data.tasks);
        }
      }
      
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, importDate: new Date().toISOString() })
      };

    default:
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
  }
}

/**
 * Check if task is completed
 */
function isTaskCompleted(task) {
  if (!task.subtasks || task.subtasks.length === 0) {
    return task.completed || false;
  }
  return task.subtasks.every(subtask => subtask.completed);
}