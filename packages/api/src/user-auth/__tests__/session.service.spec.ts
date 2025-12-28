/**
 * Session Service Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { SessionService } from '../services/session.service';
import { PrismaService } from '../../prisma/prisma.service';

// Mock Redis client
const mockRedisClient = {
  set: jest.fn().mockResolvedValue('OK'),
  get: jest.fn(),
  del: jest.fn().mockResolvedValue(1),
  keys: jest.fn().mockResolvedValue([]),
};

// Mock Prisma userSession model
const mockPrisma = {
  userSession: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  user: {
    findUnique: jest.fn(),
  },
};

describe('SessionService', () => {
  let sessionService: SessionService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: 'REDIS_CLIENT', useValue: mockRedisClient },
      ],
    }).compile();

    sessionService = module.get<SessionService>(SessionService);
  });

  describe('createSession', () => {
    it('should create a session with token', async () => {
      const userId = 'user-123';
      const userAgent = 'Mozilla/5.0';
      const ipAddress = '127.0.0.1';

      mockPrisma.userSession.create.mockResolvedValue({
        id: 'session-123',
        userId,
        sessionToken: 'generated-token',
        userAgent,
        ipAddress,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        lastActiveAt: new Date(),
      });

      const result = await sessionService.createSession(userId, userAgent, ipAddress);

      expect(result.sessionToken).toBeDefined();
      expect(result.sessionToken.length).toBe(64); // 32 bytes = 64 hex chars
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(mockPrisma.userSession.create).toHaveBeenCalled();
      expect(mockRedisClient.set).toHaveBeenCalled();
    });

    it('should store session in both Redis and database', async () => {
      const userId = 'user-123';

      mockPrisma.userSession.create.mockResolvedValue({
        id: 'session-123',
        userId,
        sessionToken: 'token',
        expiresAt: new Date(),
      });

      await sessionService.createSession(userId);

      // Verify Redis was called with correct structure
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        expect.stringMatching(/^session:/),
        expect.any(String),
        expect.objectContaining({ EX: expect.any(Number) }),
      );

      // Verify Prisma was called
      expect(mockPrisma.userSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          sessionToken: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      });
    });
  });

  describe('validateSession', () => {
    const sessionToken = 'valid-token';
    const userId = 'user-123';
    const futureDate = new Date(Date.now() + 1000000);

    it('should return user for valid session from Redis cache', async () => {
      const mockUser = { id: userId, email: 'test@test.com' };

      mockRedisClient.get.mockResolvedValue(
        JSON.stringify({ userId, expiresAt: futureDate.toISOString() }),
      );
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.userSession.update.mockResolvedValue({});

      const result = await sessionService.validateSession(sessionToken);

      expect(result).toEqual(mockUser);
      expect(mockRedisClient.get).toHaveBeenCalledWith(`session:${sessionToken}`);
    });

    it('should return null for non-existent session', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockPrisma.userSession.findUnique.mockResolvedValue(null);

      const result = await sessionService.validateSession('invalid-token');

      expect(result).toBeNull();
    });

    it('should fall back to database if not in Redis', async () => {
      const mockUser = { id: userId, email: 'test@test.com' };

      mockRedisClient.get.mockResolvedValue(null);
      mockPrisma.userSession.findUnique.mockResolvedValue({
        userId,
        expiresAt: futureDate,
        user: mockUser,
      });

      const result = await sessionService.validateSession(sessionToken);

      expect(result).toEqual(mockUser);
      // Should re-cache in Redis
      expect(mockRedisClient.set).toHaveBeenCalled();
    });

    it('should return null for expired session in database', async () => {
      const pastDate = new Date(Date.now() - 1000);

      mockRedisClient.get.mockResolvedValue(null);
      mockPrisma.userSession.findUnique.mockResolvedValue({
        userId,
        expiresAt: pastDate,
        user: { id: userId },
      });

      const result = await sessionService.validateSession(sessionToken);

      expect(result).toBeNull();
    });
  });

  describe('destroySession', () => {
    it('should delete session from Redis and database', async () => {
      const sessionToken = 'token-to-delete';

      await sessionService.destroySession(sessionToken);

      expect(mockRedisClient.del).toHaveBeenCalledWith(`session:${sessionToken}`);
      expect(mockPrisma.userSession.delete).toHaveBeenCalledWith({
        where: { sessionToken },
      });
    });
  });

  describe('destroyAllUserSessions', () => {
    it('should delete all sessions for a user', async () => {
      const userId = 'user-123';

      mockPrisma.userSession.findMany.mockResolvedValue([
        { sessionToken: 'token1' },
        { sessionToken: 'token2' },
      ]);

      await sessionService.destroyAllUserSessions(userId);

      expect(mockPrisma.userSession.findMany).toHaveBeenCalledWith({
        where: { userId },
        select: { sessionToken: true },
      });
      expect(mockRedisClient.del).toHaveBeenCalledTimes(2);
      expect(mockPrisma.userSession.deleteMany).toHaveBeenCalledWith({
        where: { userId },
      });
    });
  });
});
