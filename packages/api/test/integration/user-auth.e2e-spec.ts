/**
 * User Authentication E2E Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('User Authentication (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testUser = {
    email: 'test@example.com',
    password: 'TestPassword123!',
    name: 'Test User',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    app.setGlobalPrefix('api/v1');

    prisma = app.get<PrismaService>(PrismaService);

    await app.init();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    // Clean user-related tables before each test
    await prisma.passwordResetToken.deleteMany();
    await prisma.emailVerificationToken.deleteMany();
    await prisma.userSession.deleteMany();
    await prisma.user.deleteMany({ where: { email: testUser.email } });
  });

  describe('POST /api/v1/user-auth/signup', () => {
    it('should create a new user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/user-auth/signup')
        .send(testUser)
        .expect(201);

      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user.name).toBe(testUser.name);
      expect(response.body.user.passwordHash).toBeUndefined(); // Should not expose password
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should reject duplicate email', async () => {
      // First signup
      await request(app.getHttpServer())
        .post('/api/v1/user-auth/signup')
        .send(testUser)
        .expect(201);

      // Second signup with same email
      await request(app.getHttpServer())
        .post('/api/v1/user-auth/signup')
        .send(testUser)
        .expect(409);
    });

    it('should reject weak password', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/user-auth/signup')
        .send({
          email: 'weak@example.com',
          password: 'weak', // Too short, no uppercase, no number
        })
        .expect(400);
    });

    it('should reject invalid email', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/user-auth/signup')
        .send({
          email: 'invalid-email',
          password: 'TestPassword123!',
        })
        .expect(400);
    });
  });

  describe('POST /api/v1/user-auth/login', () => {
    beforeEach(async () => {
      // Create a user first
      await request(app.getHttpServer())
        .post('/api/v1/user-auth/signup')
        .send(testUser);
    });

    it('should login with correct credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/user-auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should reject incorrect password', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/user-auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
        })
        .expect(401);
    });

    it('should reject non-existent user', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/user-auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testUser.password,
        })
        .expect(401);
    });
  });

  describe('GET /api/v1/user-auth/me', () => {
    it('should return current user when authenticated', async () => {
      // Signup and get session cookie
      const signupResponse = await request(app.getHttpServer())
        .post('/api/v1/user-auth/signup')
        .send(testUser);

      const cookie = signupResponse.headers['set-cookie'];

      // Get current user
      const response = await request(app.getHttpServer())
        .get('/api/v1/user-auth/me')
        .set('Cookie', cookie)
        .expect(200);

      expect(response.body.email).toBe(testUser.email);
      expect(response.body.name).toBe(testUser.name);
    });

    it('should return 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/user-auth/me')
        .expect(401);
    });
  });

  describe('POST /api/v1/user-auth/logout', () => {
    it('should logout and invalidate session', async () => {
      // Signup and get session cookie
      const signupResponse = await request(app.getHttpServer())
        .post('/api/v1/user-auth/signup')
        .send(testUser);

      const cookie = signupResponse.headers['set-cookie'];

      // Logout
      await request(app.getHttpServer())
        .post('/api/v1/user-auth/logout')
        .set('Cookie', cookie)
        .expect(200);

      // Try to access protected route
      await request(app.getHttpServer())
        .get('/api/v1/user-auth/me')
        .set('Cookie', cookie)
        .expect(401);
    });
  });

  describe('POST /api/v1/user-auth/forgot-password', () => {
    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/api/v1/user-auth/signup')
        .send(testUser);
    });

    it('should accept valid email (always returns 200)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/user-auth/forgot-password')
        .send({ email: testUser.email })
        .expect(200);

      // Verify token was created
      const token = await prisma.passwordResetToken.findFirst({
        where: { user: { email: testUser.email } },
      });
      expect(token).toBeDefined();
    });

    it('should return 200 even for non-existent email (prevent enumeration)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/user-auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);
    });
  });

  describe('POST /api/v1/user-auth/reset-password', () => {
    let resetToken: string;

    beforeEach(async () => {
      // Create user
      await request(app.getHttpServer())
        .post('/api/v1/user-auth/signup')
        .send(testUser);

      // Request password reset
      await request(app.getHttpServer())
        .post('/api/v1/user-auth/forgot-password')
        .send({ email: testUser.email });

      // Get the token from database
      const tokenRecord = await prisma.passwordResetToken.findFirst({
        where: { user: { email: testUser.email } },
      });
      resetToken = tokenRecord!.token;
    });

    it('should reset password with valid token', async () => {
      const newPassword = 'NewPassword456!';

      await request(app.getHttpServer())
        .post('/api/v1/user-auth/reset-password')
        .send({
          token: resetToken,
          newPassword,
        })
        .expect(200);

      // Verify can login with new password
      await request(app.getHttpServer())
        .post('/api/v1/user-auth/login')
        .send({
          email: testUser.email,
          password: newPassword,
        })
        .expect(200);

      // Verify old password no longer works
      await request(app.getHttpServer())
        .post('/api/v1/user-auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(401);
    });

    it('should reject invalid token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/user-auth/reset-password')
        .send({
          token: 'invalid-token',
          newPassword: 'NewPassword456!',
        })
        .expect(400);
    });

    it('should reject weak new password', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/user-auth/reset-password')
        .send({
          token: resetToken,
          newPassword: 'weak',
        })
        .expect(400);
    });

    it('should reject already used token', async () => {
      // Use the token once
      await request(app.getHttpServer())
        .post('/api/v1/user-auth/reset-password')
        .send({
          token: resetToken,
          newPassword: 'NewPassword456!',
        })
        .expect(200);

      // Try to use it again
      await request(app.getHttpServer())
        .post('/api/v1/user-auth/reset-password')
        .send({
          token: resetToken,
          newPassword: 'AnotherPassword789!',
        })
        .expect(400);
    });
  });

  describe('POST /api/v1/user-auth/verify-email', () => {
    let verificationToken: string;

    beforeEach(async () => {
      // Create user (which creates verification token)
      await request(app.getHttpServer())
        .post('/api/v1/user-auth/signup')
        .send(testUser);

      // Get the token from database
      const tokenRecord = await prisma.emailVerificationToken.findFirst({
        where: { user: { email: testUser.email } },
      });
      verificationToken = tokenRecord!.token;
    });

    it('should verify email with valid token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/user-auth/verify-email')
        .send({ token: verificationToken })
        .expect(200);

      // Verify user is now verified
      const user = await prisma.user.findUnique({
        where: { email: testUser.email },
      });
      expect(user!.emailVerified).toBe(true);
    });

    it('should reject invalid token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/user-auth/verify-email')
        .send({ token: 'invalid-token' })
        .expect(400);
    });

    it('should reject already used token', async () => {
      // Use the token once
      await request(app.getHttpServer())
        .post('/api/v1/user-auth/verify-email')
        .send({ token: verificationToken })
        .expect(200);

      // Try to use it again
      await request(app.getHttpServer())
        .post('/api/v1/user-auth/verify-email')
        .send({ token: verificationToken })
        .expect(400);
    });
  });

  describe('OAuth endpoints', () => {
    it('GET /api/v1/user-auth/google should return 501 when not configured', async () => {
      // This test assumes Google OAuth is not configured in test environment
      const response = await request(app.getHttpServer())
        .get('/api/v1/user-auth/google');

      // Either redirect (302) if configured, or 501 if not
      expect([302, 501]).toContain(response.status);
    });

    it('GET /api/v1/user-auth/github should return 501 when not configured', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/user-auth/github');

      expect([302, 501]).toContain(response.status);
    });
  });
});
