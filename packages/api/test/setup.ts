/**
 * Jest Test Setup
 */

// Set test environment
process.env.NODE_ENV = 'test';

// Database - use test database
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://devflow:changeme@localhost:5432/devflow?schema=public';

// Redis - use default local Redis
process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';

// OAuth encryption key for tests (required for token encryption)
process.env.OAUTH_ENCRYPTION_KEY = process.env.OAUTH_ENCRYPTION_KEY || 'test-encryption-key-32-chars-!!';

// Increase timeout for integration tests
jest.setTimeout(60000);

// Mock console.log in tests to reduce noise
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
// };
