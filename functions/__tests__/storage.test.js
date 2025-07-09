/**
 * Unit tests for Storage Adapter
 */
const fs = require('fs').promises;
const path = require('path');
const StorageAdapter = require('../storage');

describe('StorageAdapter', () => {
  let testDataDir;
  
  beforeEach(() => {
    testDataDir = path.join(__dirname, 'test-data');
  });
  
  afterEach(async () => {
    // Clean up test data directory
    try {
      await fs.rmdir(testDataDir, { recursive: true });
    } catch (error) {
      // Directory might not exist
    }
  });
  
  describe('Memory Storage', () => {
    let storage;
    
    beforeEach(async () => {
      storage = new StorageAdapter('memory');
      await storage.init();
    });
    
    test('should save and load data', async () => {
      const testData = [
        { title: 'Test Event', date: '2025-07-09', type: 'event' }
      ];
      
      await storage.save('testuser', 'events', testData);
      const loadedData = await storage.load('testuser', 'events');
      
      expect(loadedData).toEqual(testData);
    });
    
    test('should return empty array for non-existent data', async () => {
      const loadedData = await storage.load('nonexistentuser', 'events');
      expect(loadedData).toEqual([]);
    });
    
    test('should list data types for user', async () => {
      await storage.save('testuser', 'events', []);
      await storage.save('testuser', 'tasks', []);
      
      const dataTypes = await storage.list('testuser');
      expect(dataTypes).toContain('events');
      expect(dataTypes).toContain('tasks');
    });
    
    test('should clear all data', async () => {
      await storage.save('testuser', 'events', [{ title: 'Test' }]);
      await storage.clear();
      
      const loadedData = await storage.load('testuser', 'events');
      expect(loadedData).toEqual([]);
    });
  });
  
  describe('Local File Storage', () => {
    let storage;
    
    beforeEach(async () => {
      storage = new StorageAdapter('local');
      storage.localDataDir = testDataDir;
      await storage.init();
    });
    
    test('should create data directory', async () => {
      try {
        await fs.access(testDataDir);
        // Directory exists
      } catch (error) {
        throw new Error('Data directory was not created');
      }
    });
    
    test('should save and load data from files', async () => {
      const testData = [
        { title: 'Test Event', date: '2025-07-09', type: 'event' }
      ];
      
      await storage.save('testuser', 'events', testData);
      
      // Check if file was created
      const filePath = path.join(testDataDir, 'testuser_events.json');
      try {
        await fs.access(filePath);
      } catch (error) {
        throw new Error('Data file was not created');
      }
      
      // Load data
      const loadedData = await storage.load('testuser', 'events');
      expect(loadedData).toEqual(testData);
    });
    
    test('should return empty array for non-existent file', async () => {
      const loadedData = await storage.load('nonexistentuser', 'events');
      expect(loadedData).toEqual([]);
    });
    
    test('should list data types from files', async () => {
      await storage.save('testuser', 'events', []);
      await storage.save('testuser', 'tasks', []);
      
      const dataTypes = await storage.list('testuser');
      expect(dataTypes).toContain('events');
      expect(dataTypes).toContain('tasks');
    });
    
    test('should handle JSON parsing errors gracefully', async () => {
      // Create a file with invalid JSON
      const filePath = path.join(testDataDir, 'testuser_events.json');
      await fs.writeFile(filePath, 'invalid json');
      
      const loadedData = await storage.load('testuser', 'events');
      expect(loadedData).toEqual([]);
    });
  });
  
  describe('Object Storage Mock', () => {
    let storage;
    let mockS3;
    
    beforeEach(async () => {
      storage = new StorageAdapter('object-storage');
      
      // Mock S3 client
      mockS3 = {
        putObject: jest.fn().mockReturnValue({
          promise: jest.fn().mockResolvedValue({})
        }),
        getObject: jest.fn().mockReturnValue({
          promise: jest.fn().mockResolvedValue({
            Body: { toString: () => JSON.stringify([{ title: 'Test' }]) }
          })
        }),
        listObjectsV2: jest.fn().mockReturnValue({
          promise: jest.fn().mockResolvedValue({
            Contents: [
              { Key: 'users/testuser/events.json' },
              { Key: 'users/testuser/tasks.json' }
            ]
          })
        })
      };
      
      storage.configureS3(mockS3, 'test-bucket');
      await storage.init();
    });
    
    test('should save data to object storage', async () => {
      const testData = [{ title: 'Test Event' }];
      
      await storage.save('testuser', 'events', testData);
      
      expect(mockS3.putObject).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'users/testuser/events.json',
        Body: JSON.stringify(testData),
        ContentType: 'application/json'
      });
    });
    
    test('should load data from object storage', async () => {
      const loadedData = await storage.load('testuser', 'events');
      
      expect(mockS3.getObject).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'users/testuser/events.json'
      });
      
      expect(loadedData).toEqual([{ title: 'Test' }]);
    });
    
    test('should handle NoSuchKey error', async () => {
      mockS3.getObject.mockReturnValue({
        promise: jest.fn().mockRejectedValue({ code: 'NoSuchKey' })
      });
      
      const loadedData = await storage.load('testuser', 'events');
      expect(loadedData).toEqual([]);
    });
    
    test('should list data types from object storage', async () => {
      const dataTypes = await storage.list('testuser');
      
      expect(mockS3.listObjectsV2).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Prefix: 'users/testuser/'
      });
      
      expect(dataTypes).toContain('events');
      expect(dataTypes).toContain('tasks');
    });
    
    test('should fallback to memory on object storage errors', async () => {
      // Mock S3 error
      mockS3.getObject.mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error('S3 Error'))
      });
      
      // Should fallback to memory storage
      const loadedData = await storage.load('testuser', 'events');
      expect(loadedData).toEqual([]);
    });
  });
});