const fs = require('fs').promises;
const path = require('path');

// Storage abstraction layer
class StorageAdapter {
  constructor(type = 'memory') {
    this.type = type;
    this.memoryStore = new Map();
    this.localDataDir = path.join(__dirname, 'data');
  }

  async init() {
    if (this.type === 'local') {
      // Create data directory if it doesn't exist
      try {
        await fs.mkdir(this.localDataDir, { recursive: true });
      } catch (error) {
        // Directory might already exist
      }
    }
  }

  async save(userId, dataType, data) {
    const key = `${userId}_${dataType}`;
    
    switch (this.type) {
      case 'local':
        const filePath = path.join(this.localDataDir, `${key}.json`);
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        break;
      
      case 'object-storage':
        // Will be implemented with AWS S3/Scaleway Object Storage
        if (this.s3) {
          const objectKey = `users/${userId}/${dataType}.json`;
          await this.s3.putObject({
            Bucket: this.bucketName,
            Key: objectKey,
            Body: JSON.stringify(data),
            ContentType: 'application/json'
          }).promise();
        } else {
          // Fallback to memory
          this.memoryStore.set(key, data);
        }
        break;
      
      default: // memory
        this.memoryStore.set(key, data);
        break;
    }
  }

  async load(userId, dataType) {
    const key = `${userId}_${dataType}`;
    
    switch (this.type) {
      case 'local':
        try {
          const filePath = path.join(this.localDataDir, `${key}.json`);
          const data = await fs.readFile(filePath, 'utf8');
          return JSON.parse(data);
        } catch (error) {
          return []; // Return empty array if file doesn't exist
        }
      
      case 'object-storage':
        if (this.s3) {
          try {
            const objectKey = `users/${userId}/${dataType}.json`;
            const result = await this.s3.getObject({
              Bucket: this.bucketName,
              Key: objectKey
            }).promise();
            return JSON.parse(result.Body.toString());
          } catch (error) {
            if (error.code === 'NoSuchKey') {
              return []; // Return empty array if object doesn't exist
            }
            console.error('Object Storage load error:', error);
            // Fallback to memory
            return this.memoryStore.get(key) || [];
          }
        } else {
          return this.memoryStore.get(key) || [];
        }
      
      default: // memory
        return this.memoryStore.get(key) || [];
    }
  }

  async list(userId) {
    const prefix = `${userId}_`;
    
    switch (this.type) {
      case 'local':
        try {
          const files = await fs.readdir(this.localDataDir);
          return files
            .filter(file => file.startsWith(prefix) && file.endsWith('.json'))
            .map(file => file.replace(prefix, '').replace('.json', ''));
        } catch (error) {
          return [];
        }
      
      case 'object-storage':
        // Implementation for listing objects in S3-compatible storage
        if (this.s3) {
          try {
            const result = await this.s3.listObjectsV2({
              Bucket: this.bucketName,
              Prefix: `users/${userId}/`
            }).promise();
            return result.Contents.map(obj => 
              obj.Key.replace(`users/${userId}/`, '').replace('.json', '')
            );
          } catch (error) {
            console.error('Object Storage list error:', error);
            return [];
          }
        } else {
          return Array.from(this.memoryStore.keys())
            .filter(key => key.startsWith(prefix))
            .map(key => key.replace(prefix, ''));
        }
      
      default: // memory
        return Array.from(this.memoryStore.keys())
          .filter(key => key.startsWith(prefix))
          .map(key => key.replace(prefix, ''));
    }
  }

  // Configure S3 for object storage
  configureS3(s3Client, bucketName) {
    this.s3 = s3Client;
    this.bucketName = bucketName;
    this.type = 'object-storage';
  }

  // Clear all data (useful for tests)
  async clear() {
    switch (this.type) {
      case 'local':
        try {
          const files = await fs.readdir(this.localDataDir);
          await Promise.all(
            files.map(file => fs.unlink(path.join(this.localDataDir, file)))
          );
        } catch (error) {
          // Directory might not exist
        }
        break;
      
      default: // memory and object-storage fallback
        this.memoryStore.clear();
        break;
    }
  }
}

module.exports = StorageAdapter;