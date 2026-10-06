import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import type { Response } from 'express';

import { AuthService } from './auth.service';
import { SsoService } from './sso.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SsoAuthorizeDto } from './dto/sso-authorize.dto';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SubsystemTokenAllowed } from './decorators/subsystem-token-allowed.decorator';

import { Roles } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';
import { UserRole } from '../users/user-role.enum';

import { Permission } from '../authorization/permission.enum';

import { Permissions } from '../authorization/permissions.decorator';

import { PermissionsGuard } from '../authorization/permissions.guard';
import { MjuSsoService } from './mju-sso/mju-sso.service';
import { MjuCallbackDto } from './mju-sso/mju-callback.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly ssoService: SsoService,
    private readonly mjuSso: MjuSsoService,
  ) {}

  // bcrypt.compare costs ~100 ms of CPU on purpose. Without a ceiling an
  // attacker needs no correct guess at all to exhaust the CPU for everyone.
  @RateLimit('login')
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.email, loginDto.password);
  }

  @RateLimit('refresh')
  @Post('refresh')
  refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refresh(refreshTokenDto);
  }

  /**
   * MJU SSO callback. The frontend receives `?ac=<code>` from sso.mju.ac.th
   * and posts it here; the code is exchanged server-to-server and a normal
   * Core Hub token pair comes back. Limited like password login
   * (`rateLimit.routes.mjuCallback`): a code is single-use, so guessing it is
   * pointless, but every exchange costs a request to sso.mju.ac.th.
   */
  @RateLimit('mjuCallback')
  @Post('mju/callback')
  mjuCallback(@Body() dto: MjuCallbackDto) {
    return this.mjuSso.signIn(dto.code);
  }

  @UseGuards(JwtAuthGuard)
  @SubsystemTokenAllowed()
  @Get('me')
  async getMe(
    @Req()
    request: Request & {
      user: {
        id: string;
        email: string;
        role: UserRole;
        sessionId: string;
        profileImageId: string | null;
      };
    },
  ) {
    // Whether a password is set — never the hash. Drives the setup page.
    // permissions: role + per-account grants, for hiding menus only.
    const [hasPassword, permissions] = await Promise.all([
      this.authService.hasPassword(request.user.id),
      this.authService.permissionsOf(request.user),
    ]);
    return { ...request.user, hasPassword, permissions };
  }

  /**
   * Central SSO initiation.
   *
   * Authenticates the current Core Hub user, checks the Subsystem Registry,
   * validates the callback URL and redirects the browser to the subsystem's
   * registered callback with a Core Hub access token attached.
   *
   * GET /api/v1/auth/sso/authorize?subsystem=student-service
   */
  @UseGuards(JwtAuthGuard)
  @Get('sso/authorize')
  async ssoAuthorize(
    @Req()
    request: Request & {
      user: {
        id: string;
        email: string;
        role: UserRole;
        username?: string | null;
        sessionId: string;
      };
    },
    @Query() query: SsoAuthorizeDto,
    @Res() response: Response,
  ) {
    const handoff = await this.ssoService.authorize(request.user, {
      subsystem: query.subsystem,
      callbackUrl: query.callback_url,
      state: query.state,
    });

    response.redirect(HttpStatus.FOUND, handoff.redirectUrl);
  }

  /**
   * Same checks as `sso/authorize`, but returns the handoff information as JSON
   * instead of redirecting. Useful for scripted/automated verification.
   */
  @UseGuards(JwtAuthGuard)
  @Get('sso/handoff')
  async ssoHandoff(
    @Req()
    request: Request & {
      user: {
        id: string;
        email: string;
        role: UserRole;
        username?: string | null;
        sessionId: string;
      };
    },
    @Query() query: SsoAuthorizeDto,
  ) {
    const handoff = await this.ssoService.authorize(request.user, {
      subsystem: query.subsystem,
      callbackUrl: query.callback_url,
      state: query.state,
    });

    return {
      subsystem: handoff.subsystem,
      callback_url: handoff.callbackUrl,
      redirect_url: handoff.redirectUrl,
      access_token: handoff.accessToken,
      token_type: handoff.tokenType,
      expires_in: handoff.expiresIn,
      ...(handoff.state !== undefined && { state: handoff.state }),
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin-test')
  adminTest(
    @Req()
    request: Request & {
      user: {
        id: string;
        email: string;
        role: UserRole;
        sessionId: string;
      };
    },
  ) {
    return {
      success: true,

      message: 'You have admin permission',

      user: request.user,
    };
  }
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Get('staff-test')
  staffTest(
    @Req()
    request: Request & {
      user: {
        id: string;
        email: string;
        role: UserRole;
        sessionId: string;
      };
    },
  ) {
    return {
      success: true,
      message: 'You have staff permission',
      user: request.user,
    };
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(Permission.SYSTEM_MANAGE)
  @Get('system-manage-test')
  systemManageTest(
    @Req()
    request: Request & {
      user: {
        id: string;
        email: string;
        role: UserRole;
        sessionId: string;
      };
    },
  ) {
    return {
      success: true,
      message: 'You have system manage permission',
      user: request.user,
    };
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(Permission.SYSTEM_READ, Permission.SYSTEM_MANAGE)
  @Get('system-management-test')
  systemManagementTest(
    @Req()
    request: Request & {
      user: {
        id: string;
        email: string;
        role: UserRole;
        sessionId: string;
      };
    },
  ) {
    return {
      success: true,
      message: 'You have all required system permissions',
      user: request.user,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(
    @Req()
    request: Request & {
      user: {
        id: string;
        email: string;
        role: UserRole;
        sessionId: string;
      };
    },
  ) {
    return this.authService.logout(request.user.sessionId, request.user.id);
  }

  /**
   * เปลี่ยนรหัสผ่านของตัวเอง — สำเร็จแล้ว session ทุกตัวถูกยกเลิก
   * token ที่ใช้เรียกเส้นนี้ก็ใช้ต่อไม่ได้ ต้องเข้าสู่ระบบใหม่
   */
  @RateLimit('changePassword')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  changePassword(
    @Req()
    request: Request & {
      user: {
        id: string;
        email: string;
        role: UserRole;
        sessionId: string;
      };
    },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      request.user,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  /**
   * ตั้งรหัสผ่านโดยไม่ต้องรู้รหัสเดิม — ครั้งแรก (บัญชียังไม่มีรหัส) หรือหลังลืมรหัส
   * (session ที่เพิ่ง login ผ่าน MJU SSO ไม่เกิน 10 นาที) นอกนั้น 403
   * สำเร็จแล้ว session อื่นถูกยกเลิก แต่ session นี้ใช้ต่อได้
   */
  @RateLimit('changePassword')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('password/set')
  setPassword(
    @Req()
    request: Request & {
      user: {
        id: string;
        email: string;
        role: UserRole;
        sessionId: string;
      };
    },
    @Body() dto: SetPasswordDto,
  ) {
    return this.authService.setPassword(request.user, dto.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  logoutAll(
    @Req()
    request: Request & {
      user: {
        id: string;
        email: string;
        role: UserRole;
        sessionId: string;
      };
    },
  ) {
    return this.authService.logoutAll(request.user.id);
  }
}
