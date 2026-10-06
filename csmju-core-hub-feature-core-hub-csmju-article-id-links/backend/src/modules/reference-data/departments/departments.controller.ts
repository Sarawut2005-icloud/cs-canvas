import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SubsystemTokenAllowed } from '../../auth/decorators/subsystem-token-allowed.decorator';
import { PermissionsGuard } from '../../authorization/permissions.guard';
import { Permissions } from '../../authorization/permissions.decorator';
import { Permission } from '../../authorization/permission.enum';
import { DepartmentsService } from './departments.service';
import {
  CreateDepartmentDto,
  QueryDepartmentsDto,
  UpdateDepartmentDto,
} from './dto/department.dto';

@Controller('departments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions(Permission.REFERENCE_READ)
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @SubsystemTokenAllowed()
  @Get()
  @Header('Cache-Control', 'private, max-age=300')
  async list(@Query() query: QueryDepartmentsDto) {
    return this.departments.list(query);
  }

  @SubsystemTokenAllowed()
  @Get(':code')
  @Header('Cache-Control', 'private, max-age=300')
  async get(@Param('code') code: string) {
    return this.departments.get(code);
  }

  @Post()
  @HttpCode(201)
  @Permissions(Permission.REFERENCE_MANAGE)
  async create(@Body() dto: CreateDepartmentDto) {
    return this.departments.create(dto);
  }

  @Patch(':code')
  @Permissions(Permission.REFERENCE_MANAGE)
  async update(@Param('code') code: string, @Body() dto: UpdateDepartmentDto) {
    return this.departments.update(code, dto);
  }
}
