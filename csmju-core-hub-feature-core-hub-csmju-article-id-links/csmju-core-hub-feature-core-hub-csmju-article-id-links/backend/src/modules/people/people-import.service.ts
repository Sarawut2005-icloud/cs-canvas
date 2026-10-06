import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  PersonStatus,
  PersonType,
  Prisma,
  StaffType,
} from '../../../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import {
  UsersService,
  studentUserId,
  syncRegistryRole,
  syncStaffRole,
} from '../users/users.service';
import { parseCsv, type CsvDocument, type CsvRow } from './csv-parser';
import { ImportPeopleDto } from './dto/import-people.dto';

export interface ImportRowError {
  /** เลขบรรทัดในไฟล์ต้นฉบับ */
  row: number;
  message: string;
}

export interface ImportResult {
  mode: 'dry-run' | 'commit';
  total: number;
  toCreate?: number;
  toUpdate?: number;
  /** บัญชีผู้ใช้ที่จะสร้างให้นักศึกษาใหม่ (dry-run) */
  usersToCreate?: number;
  created?: number;
  updated?: number;
  /** บัญชีผู้ใช้ที่สร้างให้นักศึกษาใหม่แล้ว (commit) */
  usersCreated?: number;
  errors: ImportRowError[];
}

const REQUIRED_HEADERS = [
  'person_code',
  'person_type',
  'full_name_th',
  'faculty_code',
] as const;

const PERSON_TYPES = Object.values(PersonType) as string[];
const STAFF_TYPES = Object.values(StaffType) as string[];
const PERSON_STATUSES = Object.values(PersonStatus) as string[];

/** แถวที่ผ่านการตรวจแล้ว พร้อม id อ้างอิงที่ resolve เสร็จ */
interface ValidRow {
  line: number;
  personCode: string;
  data: Omit<Prisma.PersonUncheckedCreateInput, 'personCode' | 'coreUserId'>;
}

function blankToNull(value: string): string | null {
  return value === '' ? null : value;
}

/** Prisma unique violation (P2002) */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

/**
 * ได้บัญชีผู้ใช้อัตโนมัติเฉพาะ "นักศึกษาใหม่" ของรอบนี้: ยังไม่มีในทะเบียน · STUDENT · ACTIVE · มีอีเมล
 * คนที่มีอยู่แล้ว (update) ไม่สร้างให้ — ตกลงกันไว้ว่าจะเพิ่มทีหลังถ้าต้องการ
 */
function needsAccount(row: ValidRow, existing: Set<string>): boolean {
  return (
    !existing.has(row.personCode) &&
    row.data.personType === PersonType.STUDENT &&
    row.data.status === PersonStatus.ACTIVE &&
    !!row.data.universityEmail
  );
}

@Injectable()
export class PeopleImportService {
  private readonly logger = new Logger(PeopleImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async import(
    dto: ImportPeopleDto,
    actor: AuthenticatedUser,
  ): Promise<ImportResult> {
    let doc: CsvDocument;
    try {
      doc = parseCsv(dto.csv);
    } catch (error) {
      throw new BadRequestException({
        message: [
          error instanceof Error ? error.message : 'ไฟล์ CSV ไม่ถูกต้อง',
        ],
      });
    }

    const missing = REQUIRED_HEADERS.filter((h) => !doc.headers.includes(h));
    if (missing.length > 0) {
      throw new BadRequestException({
        message: missing.map((h) => `ไม่มีคอลัมน์ ${h} ในไฟล์`),
      });
    }

    const checked = await this.validateRows(doc.rows);
    const errors = checked.errors;

    const existingPeople = await this.prisma.person.findMany({
      where: { personCode: { in: checked.valid.map((r) => r.personCode) } },
      select: { personCode: true, coreUserId: true },
    });
    const existing = new Set(existingPeople.map((p) => p.personCode));
    // บัญชีที่ผูกไว้แล้ว — upsert ไม่แตะ core_user_id จึงเป็นค่าสุดท้าย
    const linkedAccount = new Map(
      existingPeople.flatMap((p) =>
        p.coreUserId ? [[p.personCode, p.coreUserId] as const] : [],
      ),
    );

    // บัญชีที่จะสร้างต้องไม่ชนบัญชีเดิม — ชนแล้วเป็น error ของแถว ไม่ผูกบัญชีคนอื่นให้
    const taken = await this.findTakenAccounts(
      checked.valid.filter((r) => needsAccount(r, existing)),
    );
    const valid: ValidRow[] = [];
    for (const r of checked.valid) {
      const clash = taken.get(r.personCode);
      if (clash) errors.push({ row: r.line, message: clash });
      else valid.push(r);
    }
    errors.sort((a, b) => a.row - b.row);

    const toUpdate = valid.filter((r) => existing.has(r.personCode)).length;
    const toCreate = valid.length - toUpdate;
    const accountRows = valid.filter((r) => needsAccount(r, existing));
    const usersToCreate = accountRows.length;
    const total = doc.rows.length;

    if (dto.mode === 'dry-run') {
      this.log(
        'dry-run',
        total,
        toCreate,
        toUpdate,
        usersToCreate,
        errors.length,
        actor,
      );
      return {
        mode: 'dry-run',
        total,
        toCreate,
        toUpdate,
        usersToCreate,
        errors,
      };
    }

    // commit: มี error แม้แถวเดียว = ไม่เขียนอะไรเลย
    if (errors.length > 0) {
      this.log('commit', total, 0, 0, 0, errors.length, actor);
      throw new BadRequestException({
        message: errors.map((e) => `แถว ${e.row}: ${e.message}`),
      });
    }

    const accounts = this.users.prepareStudentAccounts(
      accountRows.map((r) => ({
        personCode: r.personCode,
        email: r.data.universityEmail as string,
      })),
    );
    const accountOf = new Map(
      accountRows.map((r, i) => [r.personCode, accounts[i].id]),
    );

    // role ของบัญชีที่ผูกไว้แล้วตามสถานะใหม่ในทะเบียน (student ↔ alumni)
    const roleSyncs = [PersonStatus.ACTIVE, PersonStatus.GRADUATED].flatMap(
      (status) => {
        const userIds = valid.flatMap((r) => {
          const userId = linkedAccount.get(r.personCode);
          return userId &&
            r.data.personType === PersonType.STUDENT &&
            r.data.status === status
            ? [userId]
            : [];
        });
        const query = syncRegistryRole(this.prisma, userIds, status);
        return query ? [query] : [];
      },
    );
    // บุคลากรที่ผูกบัญชีไว้แล้ว: role ตาม staff_type ใหม่ (อาจารย์ ↔ บุคลากรอื่น)
    const staffSyncs = [StaffType.LECTURER, null].flatMap((lecturer) => {
      const userIds = valid.flatMap((r) => {
        const userId = linkedAccount.get(r.personCode);
        const isLecturer = r.data.staffType === StaffType.LECTURER;
        return userId &&
          r.data.personType === PersonType.STAFF &&
          isLecturer === (lecturer !== null)
          ? [userId]
          : [];
      });
      const query = syncStaffRole(this.prisma, userIds, lecturer);
      return query ? [query] : [];
    });

    // upsert ไม่แตะ core_user_id ที่ผูกไว้แล้ว (พฤติกรรมเดียวกับ master-data.sql)
    // ผูกบัญชีเฉพาะตอน create ของนักศึกษาใหม่ ในธุรกรรมเดียวกับที่สร้างบัญชี
    try {
      await this.prisma.$transaction([
        ...(accounts.length > 0
          ? [this.prisma.user.createMany({ data: accounts })]
          : []),
        ...valid.map((r) => {
          const coreUserId = accountOf.get(r.personCode);
          return this.prisma.person.upsert({
            where: { personCode: r.personCode },
            create: {
              personCode: r.personCode,
              ...r.data,
              ...(coreUserId ? { coreUserId } : {}),
            },
            update: r.data,
            select: { personCode: true },
          });
        }),
        ...roleSyncs,
        ...staffSyncs,
      ]);
    } catch (error) {
      // มีคนเพิ่มบุคคล/บัญชีเดียวกันระหว่างตรวจกับบันทึก — ธุรกรรมถอยทั้งก้อนแล้ว
      if (isUniqueViolation(error)) {
        this.log('commit', total, 0, 0, 0, 0, actor);
        throw new ConflictException(
          'ข้อมูลเปลี่ยนระหว่างนำเข้า ไม่มีการบันทึกใด ๆ — กดตรวจสอบใหม่แล้วลองอีกครั้ง',
        );
      }
      throw error;
    }

    this.log('commit', total, toCreate, toUpdate, accounts.length, 0, actor);
    return {
      mode: 'commit',
      total,
      created: toCreate,
      updated: toUpdate,
      usersCreated: accounts.length,
      errors: [],
    };
  }

  /**
   * บัญชีที่ชนของเดิม (id / email / username) — คืน personCode → ข้อความ error
   * ค้นครั้งเดียวทั้งไฟล์ ไม่ยิงต่อแถว
   */
  private async findTakenAccounts(
    rows: ValidRow[],
  ): Promise<Map<string, string>> {
    const taken = new Map<string, string>();
    if (rows.length === 0) return taken;

    const emails = rows.map((r) => r.data.universityEmail as string);
    const existingUsers = await this.prisma.user.findMany({
      where: {
        OR: [
          { id: { in: rows.map((r) => studentUserId(r.personCode)) } },
          // unique ในฐานข้อมูลแยกตัวพิมพ์ — ตรวจแบบไม่แยก กันบัญชีซ้ำที่ต่างแค่ตัวพิมพ์
          { email: { in: emails, mode: 'insensitive' } },
          { username: { in: emails, mode: 'insensitive' } },
        ],
      },
      select: { id: true, email: true, username: true },
    });
    const takenIds = new Set(existingUsers.map((u) => u.id));
    const takenEmails = new Set(
      existingUsers.flatMap((u) =>
        [u.email, u.username ?? ''].map((e) => e.toLowerCase()),
      ),
    );

    for (const r of rows) {
      const email = r.data.universityEmail as string;
      if (takenEmails.has(email))
        taken.set(
          r.personCode,
          `university_email นี้มีบัญชีผู้ใช้อยู่แล้ว สร้างบัญชีให้ไม่ได้`,
        );
      else if (takenIds.has(studentUserId(r.personCode)))
        taken.set(
          r.personCode,
          `มีบัญชีผู้ใช้ ${studentUserId(r.personCode)} อยู่แล้ว สร้างบัญชีให้ไม่ได้`,
        );
    }
    return taken;
  }

  /** ตรวจทุกแถวก่อน — resolve code อ้างอิงด้วย findMany ตารางละครั้ง ไม่ยิงต่อแถว */
  private async validateRows(
    rows: CsvRow[],
  ): Promise<{ valid: ValidRow[]; errors: ImportRowError[] }> {
    const codesOf = (column: string) =>
      Array.from(
        new Set(rows.map((r) => r.values[column] ?? '').filter(Boolean)),
      );

    const [faculties, departments, curricula, emailOwners] = await Promise.all([
      this.prisma.faculty.findMany({
        where: { code: { in: codesOf('faculty_code') } },
        select: { id: true, code: true },
      }),
      this.prisma.department.findMany({
        where: { code: { in: codesOf('department_code') } },
        select: { id: true, code: true },
      }),
      this.prisma.curriculum.findMany({
        where: { code: { in: codesOf('curriculum_code') } },
        select: { id: true, code: true },
      }),
      this.prisma.person.findMany({
        where: { universityEmail: { in: codesOf('university_email') } },
        select: { personCode: true, universityEmail: true },
      }),
    ]);

    const facultyIds = new Map(faculties.map((f) => [f.code, f.id]));
    const departmentIds = new Map(departments.map((d) => [d.code, d.id]));
    const curriculumIds = new Map(curricula.map((c) => [c.code, c.id]));
    const emailOwner = new Map(
      emailOwners.map((p) => [p.universityEmail ?? '', p.personCode]),
    );

    const seenCode = new Map<string, number>();
    const seenEmail = new Map<string, number>();
    const valid: ValidRow[] = [];
    const errors: ImportRowError[] = [];

    for (const { line, values } of rows) {
      const v = (column: string) => values[column] ?? '';
      const problems: string[] = [];

      const personCode = v('person_code');
      if (!personCode) problems.push('person_code ห้ามว่าง');
      else if (seenCode.has(personCode))
        problems.push(`person_code ซ้ำกับแถว ${seenCode.get(personCode)}`);
      else seenCode.set(personCode, line);

      const personType = v('person_type').toUpperCase();
      if (!PERSON_TYPES.includes(personType))
        problems.push('person_type ต้องเป็น STUDENT หรือ STAFF');

      const staffTypeRaw = v('staff_type').toUpperCase();
      let staffType: StaffType | null = null;
      if (personType === PersonType.STAFF) {
        if (!staffTypeRaw)
          problems.push('staff_type จำเป็นเมื่อ person_type เป็น STAFF');
        else if (!STAFF_TYPES.includes(staffTypeRaw))
          problems.push(`staff_type ต้องเป็น ${STAFF_TYPES.join(' / ')}`);
        else staffType = staffTypeRaw as StaffType;
      }

      const fullNameTh = v('full_name_th');
      if (!fullNameTh) problems.push('full_name_th ห้ามว่าง');

      const facultyCode = v('faculty_code');
      const facultyId = facultyIds.get(facultyCode);
      if (!facultyCode) problems.push('faculty_code ห้ามว่าง');
      else if (!facultyId) problems.push(`ไม่พบ faculty_code '${facultyCode}'`);

      const departmentCode = v('department_code');
      const departmentId = departmentCode
        ? departmentIds.get(departmentCode)
        : null;
      if (departmentCode && !departmentId)
        problems.push(`ไม่พบ department_code '${departmentCode}'`);

      const curriculumCode = v('curriculum_code');
      const curriculumId = curriculumCode
        ? curriculumIds.get(curriculumCode)
        : null;
      if (curriculumCode && !curriculumId)
        problems.push(`ไม่พบ curriculum_code '${curriculumCode}'`);

      const entryYearRaw = v('entry_year');
      let entryYear: number | null = null;
      if (entryYearRaw) {
        if (!/^\d{4}$/.test(entryYearRaw))
          problems.push('entry_year ต้องเป็นปี พ.ศ. 4 หลัก');
        else entryYear = Number(entryYearRaw);
      }

      const statusRaw = v('status').toUpperCase();
      const status = statusRaw === '' ? PersonStatus.ACTIVE : statusRaw;
      if (!PERSON_STATUSES.includes(status))
        problems.push(
          `status ต้องเป็น ${PERSON_STATUSES.join(' / ')} หรือเว้นว่าง`,
        );

      const universityEmail = v('university_email').toLowerCase();
      if (universityEmail) {
        const owner = emailOwner.get(universityEmail);
        if (owner && owner !== personCode)
          problems.push(`university_email ซ้ำกับบุคคลอื่น (รหัส ${owner})`);
        const earlier = seenEmail.get(universityEmail);
        if (earlier !== undefined)
          problems.push(`university_email ซ้ำกับแถว ${earlier}`);
        else seenEmail.set(universityEmail, line);
      }

      if (problems.length > 0) {
        errors.push({ row: line, message: problems.join(' · ') });
        continue;
      }

      valid.push({
        line,
        personCode,
        data: {
          personType: personType as PersonType,
          staffType,
          academicTitle: blankToNull(v('academic_title')),
          fullNameTh,
          fullNameEn: blankToNull(v('full_name_en')),
          universityEmail: blankToNull(universityEmail),
          facultyId: facultyId as string,
          departmentId: departmentId ?? null,
          curriculumId: curriculumId ?? null,
          entryYear,
          status: status as PersonStatus,
        },
      });
    }

    return { valid, errors };
  }

  /** log ได้แค่จำนวน — ห้ามมีเนื้อหาแถว (ชื่อ อีเมล) เด็ดขาด */
  private log(
    mode: 'dry-run' | 'commit',
    total: number,
    created: number,
    updated: number,
    usersCreated: number,
    errorRows: number,
    actor: AuthenticatedUser,
  ) {
    this.logger.log(
      JSON.stringify({
        event: 'people.import',
        mode,
        total,
        created,
        updated,
        usersCreated,
        errorRows,
        actor: actor.id,
      }),
    );
  }
}
