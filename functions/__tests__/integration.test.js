/**
 * Integration tests for full API workflow
 */
const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { handler } = require('../index');

describe('Integration Tests', () => {
  let app;
  let testDataDir;
  
  beforeAll(() => {
    testDataDir = path.join(__dirname, 'integration-test-data');
    
    // Set environment for local file storage
    process.env.STORAGE_TYPE = 'local';
    process.env.NODE_ENV = 'test';
  });
  
  beforeEach(async () => {
    // Clean up test data directory
    try {
      await fs.rmdir(testDataDir, { recursive: true });
    } catch (error) {
      // Directory might not exist
    }
    
    // Create test app
    app = express();
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
  });
  
  afterAll(async () => {
    // Clean up test data directory
    try {
      await fs.rmdir(testDataDir, { recursive: true });
    } catch (error) {
      // Directory might not exist
    }
  });
  
  describe('Complete User Workflow', () => {
    const userId = 'integration-test-user';
    
    test('should handle complete event management workflow', async () => {
      // 1. Start with empty events
      let response = await request(app)
        .get('/api/events')
        .set('X-User-ID', userId)
        .expect(200);
      
      let events = JSON.parse(response.text);
      expect(events).toEqual([]);
      
      // 2. Add some events
      const newEvents = [
        { title: 'Midsummer', date: '2025-06-21', type: 'holiday' },
        { title: 'Vacation', date: '2025-07-15', type: 'personal' },
        { title: 'Conference', date: '2025-09-10', type: 'work' }
      ];
      
      response = await request(app)
        .post('/api/events')
        .set('X-User-ID', userId)
        .send(newEvents)
        .expect(200);
      
      const saveResult = JSON.parse(response.text);
      expect(saveResult.success).toBe(true);
      expect(saveResult.count).toBe(3);
      
      // 3. Verify events were saved
      response = await request(app)
        .get('/api/events')
        .set('X-User-ID', userId)
        .expect(200);
      
      events = JSON.parse(response.text);
      expect(events).toHaveLength(3);
      expect(events[0].title).toBe('Midsummer');
      expect(events[1].title).toBe('Vacation');
      expect(events[2].title).toBe('Conference');
      
      // 4. Update events
      const updatedEvents = [
        ...events,
        { title: 'New Year', date: '2025-12-31', type: 'holiday' }
      ];
      
      response = await request(app)
        .post('/api/events')
        .set('X-User-ID', userId)
        .send(updatedEvents)
        .expect(200);
      
      // 5. Verify update
      response = await request(app)
        .get('/api/events')
        .set('X-User-ID', userId)
        .expect(200);
      
      events = JSON.parse(response.text);
      expect(events).toHaveLength(4);
      expect(events[3].title).toBe('New Year');
    });
    
    test('should handle complete task management workflow', async () => {
      // 1. Start with empty tasks
      let response = await request(app)
        .get('/api/tasks')
        .set('X-User-ID', userId)
        .expect(200);
      
      let tasks = JSON.parse(response.text);
      expect(tasks).toEqual([]);
      
      // 2. Add some tasks
      const newTasks = [
        { title: 'Plan vacation', deadline: '2025-07-01', completed: false },
        { title: 'Book flights', deadline: '2025-07-05', completed: false },
        { title: 'Pack luggage', deadline: '2025-07-14', completed: false }
      ];
      
      response = await request(app)
        .post('/api/tasks')
        .set('X-User-ID', userId)
        .send(newTasks)
        .expect(200);
      
      const saveResult = JSON.parse(response.text);
      expect(saveResult.success).toBe(true);
      expect(saveResult.count).toBe(3);
      
      // 3. Mark some tasks as completed
      const updatedTasks = [
        { ...newTasks[0], completed: true },
        { ...newTasks[1], completed: true },
        newTasks[2]
      ];
      
      response = await request(app)
        .post('/api/tasks')
        .set('X-User-ID', userId)
        .send(updatedTasks)
        .expect(200);
      
      // 4. Verify task updates
      response = await request(app)
        .get('/api/tasks')
        .set('X-User-ID', userId)
        .expect(200);
      
      tasks = JSON.parse(response.text);
      expect(tasks).toHaveLength(3);
      expect(tasks[0].completed).toBe(true);
      expect(tasks[1].completed).toBe(true);
      expect(tasks[2].completed).toBe(false);
    });
    
    test('should handle backup and restore workflow', async () => {
      // 1. Add some data
      const events = [
        { title: 'Test Event', date: '2025-07-09', type: 'test' }
      ];
      const tasks = [
        { title: 'Test Task', deadline: '2025-07-10', completed: false }
      ];
      
      await request(app)
        .post('/api/events')
        .set('X-User-ID', userId)
        .send(events);
      
      await request(app)
        .post('/api/tasks')
        .set('X-User-ID', userId)
        .send(tasks);
      
      // 2. Create backup
      const backupResponse = await request(app)
        .get('/api/backup')
        .set('X-User-ID', userId)
        .expect(200);
      
      const backupData = JSON.parse(backupResponse.text);
      expect(backupData.data.events).toHaveLength(1);
      expect(backupData.data.tasks).toHaveLength(1);
      expect(backupData.exportDate).toBeDefined();
      
      // 3. Clear data (simulate data loss)
      await request(app)
        .post('/api/events')
        .set('X-User-ID', userId)
        .send([]);
      
      await request(app)
        .post('/api/tasks')
        .set('X-User-ID', userId)
        .send([]);
      
      // 4. Verify data is gone
      let response = await request(app)
        .get('/api/events')
        .set('X-User-ID', userId);
      
      expect(JSON.parse(response.text)).toHaveLength(0);
      
      // 5. Restore from backup
      response = await request(app)
        .post('/api/backup')
        .set('X-User-ID', userId)
        .send(backupData)
        .expect(200);
      
      const restoreResult = JSON.parse(response.text);
      expect(restoreResult.success).toBe(true);
      
      // 6. Verify data is restored
      response = await request(app)
        .get('/api/events')
        .set('X-User-ID', userId);
      
      const restoredEvents = JSON.parse(response.text);
      expect(restoredEvents).toHaveLength(1);
      expect(restoredEvents[0].title).toBe('Test Event');
    });
    
    test('should handle analytics workflow', async () => {
      // 1. Add data for analytics
      const events = [
        { title: 'Work Event', date: '2025-07-09', type: 'work' },
        { title: 'Personal Event', date: '2025-07-10', type: 'personal' },
        { title: 'Holiday', date: '2025-07-11', type: 'holiday' }
      ];
      
      const tasks = [
        { title: 'Work Task', deadline: '2025-07-09', completed: true },
        { title: 'Personal Task', deadline: '2025-07-10', completed: false }
      ];
      
      await request(app)
        .post('/api/events')
        .set('X-User-ID', userId)
        .send(events);
      
      await request(app)
        .post('/api/tasks')
        .set('X-User-ID', userId)
        .send(tasks);
      
      // 2. Get analytics
      const response = await request(app)
        .get('/api/analytics')
        .set('X-User-ID', userId)
        .expect(200);
      
      const analytics = JSON.parse(response.text);
      expect(analytics.events.total).toBe(3);
      expect(analytics.tasks.total).toBe(2);
      expect(analytics.tasks.completed).toBe(1);
      expect(analytics.tasks.pending).toBe(1);
    });
  });
  
  describe('Multi-user Isolation', () => {
    test('should keep user data completely separate', async () => {
      const user1 = 'user1';
      const user2 = 'user2';
      
      // User 1 adds events
      const user1Events = [
        { title: 'User1 Event', date: '2025-07-09', type: 'personal' }
      ];
      
      await request(app)
        .post('/api/events')
        .set('X-User-ID', user1)
        .send(user1Events);
      
      // User 2 adds different events
      const user2Events = [
        { title: 'User2 Event', date: '2025-07-10', type: 'work' }
      ];
      
      await request(app)
        .post('/api/events')
        .set('X-User-ID', user2)
        .send(user2Events);
      
      // Verify user 1 only sees their events
      let response = await request(app)
        .get('/api/events')
        .set('X-User-ID', user1)
        .expect(200);
      
      let events = JSON.parse(response.text);
      expect(events).toHaveLength(1);
      expect(events[0].title).toBe('User1 Event');
      
      // Verify user 2 only sees their events
      response = await request(app)
        .get('/api/events')
        .set('X-User-ID', user2)
        .expect(200);
      
      events = JSON.parse(response.text);
      expect(events).toHaveLength(1);
      expect(events[0].title).toBe('User2 Event');
    });
  });
});