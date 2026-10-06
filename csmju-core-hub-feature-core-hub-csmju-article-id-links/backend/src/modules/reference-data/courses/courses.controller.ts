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
import { CoursesService } from './courses.service';
import {
  CreateCourseDto,
  QueryCoursesDto,
  UpdateCourseDto,
} from './dto/course.dto';

@Controller('courses')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions(Permission.REFERENCE_READ)
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @SubsystemTokenAllowed()
  @Get()
  @Header('Cache-Control', 'private, max-age=300')
  async list(@Query() query: QueryCoursesDto) {
    return this.courses.list(query);
  }

  @SubsystemTokenAllowed()
  @Get(':code')
  @Header('Cache-Control', 'private, max-age=300')
  async get(@Param('code') code: string) {
    return this.courses.get(code);
  }

  @Post()
  @HttpCode(201)
  @Permissions(Permission.REFERENCE_MANAGE)
  async create(@Body() dto: CreateCourseDto) {
    return this.courses.create(dto);
  }

  @Patch(':code')
  @Permissions(Permission.REFERENCE_MANAGE)
  async update(@Param('code') code: string, @Body() dto: UpdateCourseDto) {
    return this.courses.update(code, dto);
  }
}
