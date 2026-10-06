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
import { AcademicTermsService } from './academic-terms.service';
import {
  CreateAcademicTermDto,
  QueryAcademicTermsDto,
  UpdateAcademicTermDto,
} from './dto/academic-term.dto';

@Controller('academic-terms')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions(Permission.REFERENCE_READ)
export class AcademicTermsController {
  constructor(private readonly terms: AcademicTermsService) {}

  @SubsystemTokenAllowed()
  @Get()
  @Header('Cache-Control', 'private, max-age=300')
  async list(@Query() query: QueryAcademicTermsDto) {
    return this.terms.list(query);
  }

  // ต้องประกาศก่อน :code ไม่งั้น "current" จะถูกตีความเป็น code
  @SubsystemTokenAllowed()
  @Get('current')
  @Header('Cache-Control', 'private, max-age=300')
  async current() {
    return this.terms.current();
  }

  @SubsystemTokenAllowed()
  @Get(':code')
  @Header('Cache-Control', 'private, max-age=300')
  async get(@Param('code') code: string) {
    return this.terms.get(code);
  }

  @SubsystemTokenAllowed()
  @Get(':code/events')
  @Header('Cache-Control', 'private, max-age=300')
  async events(@Param('code') code: string) {
    return this.terms.events(code);
  }

  @Post()
  @HttpCode(201)
  @Permissions(Permission.REFERENCE_MANAGE)
  async create(@Body() dto: CreateAcademicTermDto) {
    return this.terms.create(dto);
  }

  @Patch(':code')
  @Permissions(Permission.REFERENCE_MANAGE)
  async update(
    @Param('code') code: string,
    @Body() dto: UpdateAcademicTermDto,
  ) {
    return this.terms.update(code, dto);
  }

  @Post(':code/set-current')
  @HttpCode(200)
  @Permissions(Permission.REFERENCE_MANAGE)
  async setCurrent(@Param('code') code: string) {
    return this.terms.setCurrent(code);
  }
}
