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
import { FacultiesService } from './faculties.service';
import {
  CreateFacultyDto,
  QueryFacultiesDto,
  UpdateFacultyDto,
} from './dto/faculty.dto';

@Controller('faculties')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions(Permission.REFERENCE_READ)
export class FacultiesController {
  constructor(private readonly faculties: FacultiesService) {}

  @SubsystemTokenAllowed()
  @Get()
  @Header('Cache-Control', 'private, max-age=300')
  async list(@Query() query: QueryFacultiesDto) {
    return this.faculties.list(query);
  }

  @SubsystemTokenAllowed()
  @Get(':code')
  @Header('Cache-Control', 'private, max-age=300')
  async get(@Param('code') code: string) {
    return this.faculties.get(code);
  }

  @Post()
  @HttpCode(201)
  @Permissions(Permission.REFERENCE_MANAGE)
  async create(@Body() dto: CreateFacultyDto) {
    return this.faculties.create(dto);
  }

  @Patch(':code')
  @Permissions(Permission.REFERENCE_MANAGE)
  async update(@Param('code') code: string, @Body() dto: UpdateFacultyDto) {
    return this.faculties.update(code, dto);
  }
}
