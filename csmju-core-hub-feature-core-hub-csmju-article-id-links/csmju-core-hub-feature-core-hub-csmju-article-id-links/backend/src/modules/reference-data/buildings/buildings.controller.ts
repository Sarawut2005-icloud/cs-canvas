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
import { BuildingsService } from './buildings.service';
import {
  CreateBuildingDto,
  QueryBuildingsDto,
  UpdateBuildingDto,
} from './dto/building.dto';

@Controller('buildings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions(Permission.REFERENCE_READ)
export class BuildingsController {
  constructor(private readonly buildings: BuildingsService) {}

  @SubsystemTokenAllowed()
  @Get()
  @Header('Cache-Control', 'private, max-age=300')
  async list(@Query() query: QueryBuildingsDto) {
    return this.buildings.list(query);
  }

  @SubsystemTokenAllowed()
  @Get(':code')
  @Header('Cache-Control', 'private, max-age=300')
  async get(@Param('code') code: string) {
    return this.buildings.get(code);
  }

  @Post()
  @HttpCode(201)
  @Permissions(Permission.REFERENCE_MANAGE)
  async create(@Body() dto: CreateBuildingDto) {
    return this.buildings.create(dto);
  }

  @Patch(':code')
  @Permissions(Permission.REFERENCE_MANAGE)
  async update(@Param('code') code: string, @Body() dto: UpdateBuildingDto) {
    return this.buildings.update(code, dto);
  }
}
