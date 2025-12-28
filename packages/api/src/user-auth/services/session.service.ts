import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { User } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class SessionService {
  private readonly SESSION_PREFIX = 'session:';
  private readonly SESSION_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: any,
  ) {}

  async createSession(
    userId: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{ sessionToken: string; expiresAt: Date }> {
    const sessionToken = this.generateSecureToken();
    const expiresAt = new Date(Date.now() + this.SESSION_TTL * 1000);

    // Store in Redis for fast lookup
    await this.redis.set(
      `${this.SESSION_PREFIX}${sessionToken}`,
      JSON.stringify({ userId, expiresAt: expiresAt.toISOString() }),
      { EX: this.SESSION_TTL },
    );

    // Store in database for persistence
    await this.prisma.userSession.create({
      data: {
        userId,
        sessionToken,
        userAgent,
        ipAddress,
        expiresAt,
      },
    });

    return { sessionToken, expiresAt };
  }

  async validateSession(sessionToken: string): Promise<User | null> {
    // Try Redis first
    const cached = await this.redis.get(`${this.SESSION_PREFIX}${sessionToken}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (new Date(parsed.expiresAt) > new Date()) {
        // Update last active time in background
        this.updateLastActive(sessionToken).catch(() => {});
        return this.prisma.user.findUnique({ where: { id: parsed.userId } });
      }
    }

    // Fallback to database
    const session = await this.prisma.userSession.findUnique({
      where: { sessionToken },
      include: { user: true },
    });

    if (session && session.expiresAt > new Date()) {
      // Re-cache in Redis
      const ttl = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000);
      if (ttl > 0) {
        await this.redis.set(
          `${this.SESSION_PREFIX}${sessionToken}`,
          JSON.stringify({
            userId: session.userId,
            expiresAt: session.expiresAt.toISOString(),
          }),
          { EX: ttl },
        );
      }
      return session.user;
    }

    return null;
  }

  async destroySession(sessionToken: string): Promise<void> {
    await Promise.all([
      this.redis.del(`${this.SESSION_PREFIX}${sessionToken}`),
      this.prisma.userSession.delete({ where: { sessionToken } }).catch(() => {}),
    ]);
  }

  async destroyAllUserSessions(userId: string): Promise<void> {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId },
      select: { sessionToken: true },
    });

    // Delete from Redis
    await Promise.all(
      sessions.map((s) => this.redis.del(`${this.SESSION_PREFIX}${s.sessionToken}`)),
    );

    // Delete from database
    await this.prisma.userSession.deleteMany({ where: { userId } });
  }

  private async updateLastActive(sessionToken: string): Promise<void> {
    await this.prisma.userSession.update({
      where: { sessionToken },
      data: { lastActiveAt: new Date() },
    });
  }

  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
