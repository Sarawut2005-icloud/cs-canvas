import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { AuthMethod } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  createSessionId(): string {
    return randomUUID();
  }

  async createSession(
    id: string,
    userId: string,
    expiresAt: Date,
    refreshTokenHash: string,
    authMethod: AuthMethod,
  ) {
    return this.prisma.session.create({
      data: {
        id,
        userId,
        status: 'ACTIVE',
        refreshTokenHash,
        authMethod,
        expiresAt,
      },
    });
  }

  async getSession(sessionId: string) {
    return this.prisma.session.findUnique({
      where: {
        id: sessionId,
      },
    });
  }

  async getUserSessions(userId: string) {
    return this.prisma.session.findMany({
      where: {
        userId,
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        expiresAt: true,
        revokedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async updateRefreshTokenHash(
    sessionId: string,
    refreshTokenHash: string,
    currentRefreshTokenHash: string,
  ): Promise<boolean> {
    const result = await this.prisma.session.updateMany({
      where: {
        id: sessionId,
        status: 'ACTIVE',
        refreshTokenHash: currentRefreshTokenHash,
      },
      data: {
        refreshTokenHash,
      },
    });

    return result.count === 1;
  }

  async revokeSession(sessionId: string, userId: string): Promise<boolean> {
    const session = await this.prisma.session.findFirst({
      where: {
        id: sessionId,
        userId,
        status: 'ACTIVE',
      },
    });

    if (!session) {
      return false;
    }

    await this.prisma.session.update({
      where: {
        id: sessionId,
      },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
      },
    });

    return true;
  }

  async revokeAllUserSessions(userId: string): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
      },
    });

    return result.count;
  }
}
