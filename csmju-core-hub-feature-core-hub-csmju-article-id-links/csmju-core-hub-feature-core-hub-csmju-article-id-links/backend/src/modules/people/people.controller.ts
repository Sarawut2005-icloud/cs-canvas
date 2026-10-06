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
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubsystemTokenAllowed } from '../auth/decorators/subsystem-token-allowed.decorator';
import { PermissionsGuard } from '../authorization/permissions.guard';
import { Permissions } from '../authorization/permissions.decorator';
import { Permission } from '../authorization/permission.enum';
import { roleHasPermission } from '../authorization/role-permissions';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';
import { PeopleImportService } from './people-import.service';
import { PeopleService } from './people.service';
import { ImportPeopleDto } from './dto/import-people.dto';
import {
  ExportPeopleDto,
  QueryAdviseesDto,
  QueryPeopleDto,
} from './dto/query-people.dto';
import { UpdatePersonDto } from './dto/update-person.dto';

/** ผู้เรียกมีสิทธิ์เห็นอีเมลของคนอื่นไหม */
function canSeeContact(user: AuthenticatedUser): boolean {
  return roleHasPermission(user.role, Permission.PEOPLE_CONTACT_READ);
}

/**
 * ทะเบียนบุคคล (นักศึกษา + บุคลากร) — `/api/v1/people`
 *
 * ข้อมูลส่วนบุคคล ห้าม cache ทุกฝั่ง: ทุก route ตอบ `Cache-Control: no-store`
 * ทุก route ประกาศสิทธิ์ของตัวเอง เพราะ PermissionsGuard ปล่อย route ที่ไม่มี decorator ผ่าน
 */
@Controller('people')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PeopleController {
  constructor(
    private readonly people: PeopleService,
    private readonly importer: PeopleImportService,
  ) {}

  // ---------- ข้อมูลของตัวเอง — ต้องประกาศก่อน :personCode ----------

  /** ยังไม่ผูกบัญชีกับบุคคล → 200 + data: null */
  @SubsystemTokenAllowed()
  @Get('me')
  @Header('Cache-Control', 'no-store')
  @Permissions(Permission.PEOPLE_ME_READ)
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.people.findMe(user.id);
  }

  /** ตารางเรียนภาคปัจจุบันของตัวเอง — ยังไม่ผูกบัญชีหรือไม่มีภาคปัจจุบัน → [] */
  @Get('me/schedule')
  @Header('Cache-Control', 'no-store')
  @Permissions(Permission.PEOPLE_ME_READ)
  async mySchedule(@CurrentUser() user: AuthenticatedUser) {
    return this.people.findMySchedule(user.id);
  }

  // ---------- นำเข้า CSV (admin) — ต้องประกาศก่อน :personCode ----------

  @Post('import')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Permissions(Permission.PEOPLE_MANAGE)
  async import(
    @Body() dto: ImportPeopleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.importer.import(dto, user);
  }

  // ---------- export CSV (staff/admin) — ต้องประกาศก่อน :personCode ----------

  /**
   * ตอบ `text/csv` ดิบ ไม่ห่อ envelope — endpoint เดียวของ /people ที่เป็นแบบนี้ เพราะผลลัพธ์
   * คือไฟล์ให้เบราว์เซอร์ดาวน์โหลดตรง (ResponseInterceptor ปล่อย StreamableFile ผ่าน)
   * error ยังเป็น envelope ตามปกติ · ไม่อยู่ใน allowlist ของ token ระบบย่อย
   */
  @Get('export')
  @Header('Cache-Control', 'no-store')
  @Permissions(Permission.PEOPLE_EXPORT)
  async export(
    @Query() query: ExportPeopleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const csv = await this.people.exportCsv(query, user.id);
    return new StreamableFile(Buffer.from(csv, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: 'attachment; filename="people.csv"',
    });
  }

  // ---------- รายชื่อ (staff/admin) ----------

  @SubsystemTokenAllowed()
  @Get()
  @Header('Cache-Control', 'no-store')
  @Permissions(Permission.PEOPLE_READ)
  async list(
    @Query() query: QueryPeopleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.people.list(query, canSeeContact(user));
  }

  @SubsystemTokenAllowed()
  @Get(':personCode')
  @Header('Cache-Control', 'no-store')
  @Permissions(Permission.PEOPLE_READ)
  async get(
    @Param('personCode') personCode: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.people.get(personCode, canSeeContact(user));
  }

  @SubsystemTokenAllowed()
  @Get(':personCode/advisors')
  @Header('Cache-Control', 'no-store')
  @Permissions(Permission.PEOPLE_READ)
  async advisorsOf(
    @Param('personCode') personCode: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.people.advisors(personCode, canSeeContact(user));
  }

  @SubsystemTokenAllowed()
  @Get(':personCode/advisees')
  @Header('Cache-Control', 'no-store')
  @Permissions(Permission.PEOPLE_READ)
  async adviseesOf(
    @Param('personCode') personCode: string,
    @Query() query: QueryAdviseesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.people.advisees(personCode, query.status, canSeeContact(user));
  }

  // ---------- แก้สถานะ / ผูกบัญชี (admin) ----------

  @Patch(':personCode')
  @Header('Cache-Control', 'no-store')
  @Permissions(Permission.PEOPLE_MANAGE)
  async update(
    @Param('personCode') personCode: string,
    @Body() dto: UpdatePersonDto,
  ) {
    return this.people.update(personCode, dto);
  }
}
