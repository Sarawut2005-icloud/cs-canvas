import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SubsystemTokenAllowed } from '../../auth/decorators/subsystem-token-allowed.decorator';
import { PermissionsGuard } from '../../authorization/permissions.guard';
import { Permissions } from '../../authorization/permissions.decorator';
import { Permission } from '../../authorization/permission.enum';
import { CurriculaService } from './curricula.service';
import { CurriculumStructureService } from './curriculum-structure.service';
import {
  CreateCurriculumDto,
  QueryCurriculaDto,
  UpdateCurriculumDto,
} from './dto/curriculum.dto';
import {
  AddCurriculumCourseDto,
  CreateCourseGroupDto,
  CreatePlanSlotDto,
  PutCreditRuleDto,
  UpdateCourseGroupDto,
  UpdateCurriculumCourseDto,
  UpdatePlanSlotDto,
} from './dto/curriculum-structure.dto';

@Controller('curricula')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions(Permission.REFERENCE_READ)
export class CurriculaController {
  constructor(
    private readonly curricula: CurriculaService,
    private readonly structureEditor: CurriculumStructureService,
  ) {}

  @SubsystemTokenAllowed()
  @Get()
  @Header('Cache-Control', 'private, max-age=300')
  async list(@Query() query: QueryCurriculaDto) {
    return this.curricula.list(query);
  }

  @SubsystemTokenAllowed()
  @Get(':code/structure')
  @Header('Cache-Control', 'private, max-age=300')
  async structure(@Param('code') code: string) {
    return this.curricula.structure(code);
  }

  @SubsystemTokenAllowed()
  @Get(':code/study-plan')
  @Header('Cache-Control', 'private, max-age=300')
  async studyPlan(@Param('code') code: string) {
    return this.curricula.studyPlan(code);
  }

  @SubsystemTokenAllowed()
  @Get(':code')
  @Header('Cache-Control', 'private, max-age=300')
  async get(@Param('code') code: string) {
    return this.curricula.get(code);
  }

  @Post()
  @HttpCode(201)
  @Permissions(Permission.REFERENCE_MANAGE)
  async create(@Body() dto: CreateCurriculumDto) {
    return this.curricula.create(dto);
  }

  @Patch(':code')
  @Permissions(Permission.REFERENCE_MANAGE)
  async update(@Param('code') code: string, @Body() dto: UpdateCurriculumDto) {
    return this.curricula.update(code, dto);
  }
  // ---------- แก้โครงสร้างหลักสูตรและแผนการเรียน (admin · หน้าหลังบ้าน) ----------
  // ทุก route ข้างล่างไม่มี @SubsystemTokenAllowed — token ของระบบย่อยได้ 403 (ข้อ 2.6 · reference-data.md 2.4)
  // GET ข้างล่างเป็นมุมมองสำหรับแก้ (มี id ของกลุ่ม/ช่อง) จึงต้องใช้ reference:manage ด้วย

  @Get(':code/course-groups')
  @Header('Cache-Control', 'no-store')
  @Permissions(Permission.REFERENCE_MANAGE)
  async listGroups(@Param('code') code: string) {
    return this.structureEditor.listGroups(code);
  }

  @Post(':code/course-groups')
  @HttpCode(201)
  @Permissions(Permission.REFERENCE_MANAGE)
  async createGroup(
    @Param('code') code: string,
    @Body() dto: CreateCourseGroupDto,
  ) {
    return this.structureEditor.createGroup(code, dto);
  }

  @Patch(':code/course-groups/:groupId')
  @Permissions(Permission.REFERENCE_MANAGE)
  async updateGroup(
    @Param('code') code: string,
    @Param('groupId') groupId: string,
    @Body() dto: UpdateCourseGroupDto,
  ) {
    return this.structureEditor.updateGroup(code, groupId, dto);
  }

  @Delete(':code/course-groups/:groupId')
  @Permissions(Permission.REFERENCE_MANAGE)
  async deleteGroup(
    @Param('code') code: string,
    @Param('groupId') groupId: string,
  ) {
    return this.structureEditor.deleteGroup(code, groupId);
  }

  @Get(':code/courses')
  @Header('Cache-Control', 'no-store')
  @Permissions(Permission.REFERENCE_MANAGE)
  async listCourses(@Param('code') code: string) {
    return this.structureEditor.listCourses(code);
  }

  @Post(':code/courses')
  @HttpCode(201)
  @Permissions(Permission.REFERENCE_MANAGE)
  async addCourse(
    @Param('code') code: string,
    @Body() dto: AddCurriculumCourseDto,
  ) {
    return this.structureEditor.addCourse(code, dto);
  }

  @Patch(':code/courses/:courseCode')
  @Permissions(Permission.REFERENCE_MANAGE)
  async updateCourse(
    @Param('code') code: string,
    @Param('courseCode') courseCode: string,
    @Body() dto: UpdateCurriculumCourseDto,
  ) {
    return this.structureEditor.updateCourse(code, courseCode, dto);
  }

  @Delete(':code/courses/:courseCode')
  @Permissions(Permission.REFERENCE_MANAGE)
  async removeCourse(
    @Param('code') code: string,
    @Param('courseCode') courseCode: string,
  ) {
    return this.structureEditor.removeCourse(code, courseCode);
  }

  @Put(':code/credit-rules/:category')
  @Permissions(Permission.REFERENCE_MANAGE)
  async putCreditRule(
    @Param('code') code: string,
    @Param('category') category: string,
    @Body() dto: PutCreditRuleDto,
  ) {
    return this.structureEditor.putCreditRule(code, category, dto);
  }

  @Delete(':code/credit-rules/:category')
  @Permissions(Permission.REFERENCE_MANAGE)
  async deleteCreditRule(
    @Param('code') code: string,
    @Param('category') category: string,
  ) {
    return this.structureEditor.deleteCreditRule(code, category);
  }

  @Get(':code/plan-slots')
  @Header('Cache-Control', 'no-store')
  @Permissions(Permission.REFERENCE_MANAGE)
  async listPlanSlots(@Param('code') code: string) {
    return this.structureEditor.listPlanSlots(code);
  }

  @Post(':code/plan-slots')
  @HttpCode(201)
  @Permissions(Permission.REFERENCE_MANAGE)
  async createPlanSlot(
    @Param('code') code: string,
    @Body() dto: CreatePlanSlotDto,
  ) {
    return this.structureEditor.createPlanSlot(code, dto);
  }

  @Patch(':code/plan-slots/:slotId')
  @Permissions(Permission.REFERENCE_MANAGE)
  async updatePlanSlot(
    @Param('code') code: string,
    @Param('slotId') slotId: string,
    @Body() dto: UpdatePlanSlotDto,
  ) {
    return this.structureEditor.updatePlanSlot(code, slotId, dto);
  }

  @Delete(':code/plan-slots/:slotId')
  @Permissions(Permission.REFERENCE_MANAGE)
  async deletePlanSlot(
    @Param('code') code: string,
    @Param('slotId') slotId: string,
  ) {
    return this.structureEditor.deletePlanSlot(code, slotId);
  }
}
