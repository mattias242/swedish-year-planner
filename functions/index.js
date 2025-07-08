/**
 * Scaleway Serverless Function for Swedish Year Planner
 * Handles API endpoints for data persistence and analytics
 */

const cors = require('cors');

// Note: Object Storage integration requires environment variables to be configured
// For now, using in-memory storage as fallback
const useObjectStorage = process.env.SCW_ACCESS_KEY && process.env.SCW_SECRET_KEY;

let s3, BUCKET_NAME;
if (useObjectStorage) {
  const AWS = require('aws-sdk');
  s3 = new AWS.S3({
    endpoint: 'https://s3.fr-par.scw.cloud',
    region: 'fr-par',
    accessKeyId: process.env.SCW_ACCESS_KEY,
    secretAccessKey: process.env.SCW_SECRET_KEY,
    s3ForcePathStyle: true
  });
  BUCKET_NAME = process.env.BUCKET_NAME || 'swedish-year-planner-prod';
}

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

// Simple in-memory storage (fallback when Object Storage not configured)
const storage = new Map();

// Scaleway Object Storage helper functions
async function saveUserData(userId, dataType, data) {
  if (useObjectStorage) {
    const key = `users/${userId}/${dataType}.json`;
    try {
      await s3.putObject({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: JSON.stringify(data),
        ContentType: 'application/json'
      }).promise();
      return true;
    } catch (error) {
      console.error('Failed to save to Object Storage:', error);
      // Fall back to in-memory storage
      storage.set(`${userId}_${dataType}`, data);
      return true;
    }
  } else {
    // Use in-memory storage
    storage.set(`${userId}_${dataType}`, data);
    return true;
  }
}

async function loadUserData(userId, dataType) {
  if (useObjectStorage) {
    const key = `users/${userId}/${dataType}.json`;
    try {
      const result = await s3.getObject({
        Bucket: BUCKET_NAME,
        Key: key
      }).promise();
      return JSON.parse(result.Body.toString());
    } catch (error) {
      if (error.code === 'NoSuchKey') {
        return []; // Return empty array if file doesn't exist
      }
      console.error('Failed to load from Object Storage:', error);
      // Fall back to in-memory storage
      return storage.get(`${userId}_${dataType}`) || [];
    }
  } else {
    // Use in-memory storage
    return storage.get(`${userId}_${dataType}`) || [];
  }
}

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

  switch (method) {
    case 'GET':
      try {
        const events = await loadUserData(userId, 'events');
        return {
          statusCode: 200,
          body: JSON.stringify(events)
        };
      } catch (error) {
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Failed to load events' })
        };
      }

    case 'POST':
      try {
        const newEvents = JSON.parse(body || '[]');
        await saveUserData(userId, 'events', newEvents);
        return {
          statusCode: 200,
          body: JSON.stringify({ success: true, count: newEvents.length })
        };
      } catch (error) {
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Failed to save events' })
        };
      }

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

  switch (method) {
    case 'GET':
      try {
        const tasks = await loadUserData(userId, 'tasks');
        return {
          statusCode: 200,
          body: JSON.stringify(tasks)
        };
      } catch (error) {
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Failed to load tasks' })
        };
      }

    case 'POST':
      try {
        const newTasks = JSON.parse(body || '[]');
        await saveUserData(userId, 'tasks', newTasks);
        return {
          statusCode: 200,
          body: JSON.stringify({ success: true, count: newTasks.length })
        };
      } catch (error) {
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Failed to save tasks' })
        };
      }

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
  
  try {
    const events = await loadUserData(userId, 'events');
    const tasks = await loadUserData(userId, 'tasks');

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
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to load analytics data' })
    };
  }
}

/**
 * Handle backup/export API
 */
async function handleBackup(method, body, headers) {
  const userId = headers['x-user-id'] || 'anonymous';

  switch (method) {
    case 'GET':
      try {
        // Export user data
        const events = await loadUserData(userId, 'events');
        const tasks = await loadUserData(userId, 'tasks');
        
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
      } catch (error) {
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Failed to export data' })
        };
      }

    case 'POST':
      try {
        // Import user data
        const backupData = JSON.parse(body);
        if (backupData.data) {
          if (backupData.data.events) {
            await saveUserData(userId, 'events', backupData.data.events);
          }
          if (backupData.data.tasks) {
            await saveUserData(userId, 'tasks', backupData.data.tasks);
          }
        }
        
        return {
          statusCode: 200,
          body: JSON.stringify({ success: true, importDate: new Date().toISOString() })
        };
      } catch (error) {
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Failed to import data' })
        };
      }

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