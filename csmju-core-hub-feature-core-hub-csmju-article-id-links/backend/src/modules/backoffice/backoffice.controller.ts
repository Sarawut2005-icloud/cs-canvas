import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../authorization/permissions.guard';
import { Permissions } from '../authorization/permissions.decorator';
import { Permission } from '../authorization/permission.enum';
import { BackofficeSummaryService } from './backoffice-summary.service';

/** ข้อมูลประกอบหน้า backoffice — staff/admin (system:manage) */
@Controller('backoffice')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BackofficeController {
  constructor(private readonly summary: BackofficeSummaryService) {}

  @Get('summary')
  @Permissions(Permission.SYSTEM_MANAGE)
  async getSummary() {
    return this.summary.summary();
  }
}
