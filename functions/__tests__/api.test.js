/**
 * Unit tests for API endpoints
 */
const request = require('supertest');
const express = require('express');
const { handler } = require('../index');

// Mock storage to avoid file system dependencies in tests
jest.mock('../storage', () => {
  return class MockStorage {
    constructor() {
      this.data = new Map();
    }
    
    async init() {}
    
    async save(userId, dataType, data) {
      const key = `${userId}_${dataType}`;
      this.data.set(key, data);
    }
    
    async load(userId, dataType) {
      const key = `${userId}_${dataType}`;
      return this.data.get(key) || [];
    }
    
    async list(userId) {
      const prefix = `${userId}_`;
      return Array.from(this.data.keys())
        .filter(key => key.startsWith(prefix))
        .map(key => key.replace(prefix, ''));
    }
    
    async clear() {
      this.data.clear();
    }
    
    configureS3() {
      // Mock S3 configuration
    }
  };
});

// Helper function to create test app
function createTestApp() {
  const app = express();
  app.use(express.json());
  
  app.all('*', async (req, res) => {
    try {
      const event = {
        httpMethod: req.method,
        path: req.path,
        headers: req.headers,
        body: req.body ? JSON.stringify(req.body) : null,
        queryStringParameters: req.query
      };
      
      const result = await handler(event, {});
      
      if (result.headers) {
        Object.entries(result.headers).forEach(([key, value]) => {
          res.set(key, value);
        });
      }
      
      res.status(result.statusCode || 200);
      if (result.body) {
        res.send(result.body);
      } else {
        res.end();
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  return app;
}

describe('API Endpoints', () => {
  let app;
  
  beforeEach(() => {
    app = createTestApp();
  });
  
  describe('Health Check', () => {
    test('GET /api/health should return healthy status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);
      
      const data = JSON.parse(response.text);
      expect(data.status).toBe('healthy');
      expect(data.timestamp).toBeDefined();
      expect(data.version).toBe('1.0.0');
    });
  });
  
  describe('Events API', () => {
    test('GET /api/events should return empty array initially', async () => {
      const response = await request(app)
        .get('/api/events')
        .set('X-User-ID', 'testuser')
        .expect(200);
      
      const data = JSON.parse(response.text);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(0);
    });
    
    test('POST /api/events should save events', async () => {
      const testEvents = [
        { title: 'Test Event', date: '2025-07-09', type: 'event' },
        { title: 'Another Event', date: '2025-07-10', type: 'event' }
      ];
      
      const response = await request(app)
        .post('/api/events')
        .set('X-User-ID', 'testuser')
        .send(testEvents)
        .expect(200);
      
      const data = JSON.parse(response.text);
      expect(data.success).toBe(true);
      expect(data.count).toBe(2);
    });
    
    test('GET /api/events should return saved events', async () => {
      const testEvents = [
        { title: 'Test Event', date: '2025-07-09', type: 'event' }
      ];
      
      // Save events
      await request(app)
        .post('/api/events')
        .set('X-User-ID', 'testuser')
        .send(testEvents);
      
      // Get events
      const response = await request(app)
        .get('/api/events')
        .set('X-User-ID', 'testuser')
        .expect(200);
      
      const data = JSON.parse(response.text);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(1);
      expect(data[0].title).toBe('Test Event');
    });
    
    test('Different users should have separate data', async () => {
      const events1 = [{ title: 'User1 Event', date: '2025-07-09', type: 'event' }];
      const events2 = [{ title: 'User2 Event', date: '2025-07-10', type: 'event' }];
      
      // Save events for user1
      await request(app)
        .post('/api/events')
        .set('X-User-ID', 'user1')
        .send(events1);
      
      // Save events for user2
      await request(app)
        .post('/api/events')
        .set('X-User-ID', 'user2')
        .send(events2);
      
      // Get events for user1
      const response1 = await request(app)
        .get('/api/events')
        .set('X-User-ID', 'user1');
      
      const data1 = JSON.parse(response1.text);
      expect(data1.length).toBe(1);
      expect(data1[0].title).toBe('User1 Event');
      
      // Get events for user2
      const response2 = await request(app)
        .get('/api/events')
        .set('X-User-ID', 'user2');
      
      const data2 = JSON.parse(response2.text);
      expect(data2.length).toBe(1);
      expect(data2[0].title).toBe('User2 Event');
    });
  });
  
  describe('Tasks API', () => {
    test('GET /api/tasks should return empty array initially', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .set('X-User-ID', 'testuser')
        .expect(200);
      
      const data = JSON.parse(response.text);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(0);
    });
    
    test('POST /api/tasks should save tasks', async () => {
      const testTasks = [
        { title: 'Test Task', date: '2025-07-09', completed: false },
        { title: 'Another Task', date: '2025-07-10', completed: true }
      ];
      
      const response = await request(app)
        .post('/api/tasks')
        .set('X-User-ID', 'testuser')
        .send(testTasks)
        .expect(200);
      
      const data = JSON.parse(response.text);
      expect(data.success).toBe(true);
      expect(data.count).toBe(2);
    });
  });
  
  describe('Error Handling', () => {
    test('Should return 405 for unsupported methods', async () => {
      await request(app)
        .patch('/api/events')
        .set('X-User-ID', 'testuser')
        .expect(405);
    });
    
    test('Should return 404 for unknown endpoints', async () => {
      await request(app)
        .get('/api/unknown')
        .expect(404);
    });
    
    test('Should handle missing user ID gracefully', async () => {
      const response = await request(app)
        .get('/api/events')
        .expect(200);
      
      // Should use 'anonymous' as default user
      const data = JSON.parse(response.text);
      expect(Array.isArray(data)).toBe(true);
    });
  });
  
  describe('CORS', () => {
    test('Should include CORS headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });
    
    test('Should handle OPTIONS preflight requests', async () => {
      await request(app)
        .options('/api/events')
        .expect(200);
    });
  });
});