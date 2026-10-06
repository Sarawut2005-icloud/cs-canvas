import { Controller, Delete, Get, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';

import { SessionService } from './session.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
  };
}

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(private readonly sessionService: SessionService) {}

  @Get()
  async getMySessions(@Req() req: AuthenticatedRequest) {
    return this.sessionService.getUserSessions(req.user.id);
  }
  @Delete('all')
  async revokeAllMySessions(@Req() req: AuthenticatedRequest) {
    const count = await this.sessionService.revokeAllUserSessions(req.user.id);

    return {
      revokedCount: count,
    };
  }

  @Delete(':id')
  async revokeMySession(
    @Param('id') sessionId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const revoked = await this.sessionService.revokeSession(
      sessionId,
      req.user.id,
    );

    return {
      revoked,
    };
  }
}
