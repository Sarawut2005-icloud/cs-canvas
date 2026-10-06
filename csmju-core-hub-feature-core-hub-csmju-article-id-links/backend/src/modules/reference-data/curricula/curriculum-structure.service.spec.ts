import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PrismaService } from '../../../database/prisma.service';
import { PERMISSIONS_KEY } from '../../authorization/permissions.decorator';
import { Permission } from '../../authorization/permission.enum';
import { SUBSYSTEM_TOKEN_ALLOWED_KEY } from '../../auth/decorators/subsystem-token-allowed.decorator';
import { CurriculaController } from './curricula.controller';
import { CurriculumStructureService } from './curriculum-structure.service';
import {
  AddCurriculumCourseDto,
  CreatePlanSlotDto,
} from './dto/curriculum-structure.dto';

// ข้อมูลสมมติ (mock) เท่านั้น
const CUR = { id: 'cur-1' };
const GROUP_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_GROUP_ID = '22222222-2222-4222-8222-222222222222';

function makeService() {
  const fn = () => jest.fn();
  const prisma = {
    curriculum: { findUnique: fn().mockResolvedValue(CUR) },
    course: { findUnique: fn().mockResolvedValue({ id: 'course-1' }) },
    curriculumCourseGroup: {
      findMany: fn().mockResolvedValue([]),
      findFirst: fn().mockImplementation(
        ({ where }: { where: { id: string } }) =>
          Promise.resolve(
            where.id === GROUP_ID
              ? { id: GROUP_ID, nameTh: 'กลุ่มสมมติ' }
              : null,
          ),
      ),
      create: fn().mockResolvedValue({ id: GROUP_ID }),
      update: fn().mockResolvedValue({ id: GROUP_ID }),
      delete: fn().mockResolvedValue({}),
    },
    curriculumCourse: {
      findMany: fn().mockResolvedValue([]),
      findFirst: fn().mockResolvedValue({
        id: 'cc-1',
        recommendedYear: 2,
        recommendedSemester: 1,
      }),
      count: fn().mockResolvedValue(0),
      create: fn(),
      update: fn(),
      delete: fn().mockResolvedValue({}),
    },
    curriculumCreditRule: {
      upsert: fn().mockResolvedValue({ category: 'CORE', minCredits: 30 }),
      deleteMany: fn().mockResolvedValue({ count: 1 }),
    },
    curriculumPlanSlot: {
      findMany: fn().mockResolvedValue([]),
      findFirst: fn().mockResolvedValue({ id: 'slot-1' }),
      count: fn().mockResolvedValue(0),
      create: fn().mockResolvedValue({ id: 'slot-1' }),
      update: fn().mockResolvedValue({ id: 'slot-1' }),
      delete: fn().mockResolvedValue({}),
    },
  };
  const courseRow = (overrides: Record<string, unknown> = {}) => ({
    category: 'MAJOR_REQUIRED',
    courseGroupId: GROUP_ID,
    isRequired: true,
    choiceGroup: null,
    isCountedInPlan: true,
    planNote: null,
    recommendedYear: 2,
    recommendedSemester: 1,
    course: {
      code: 'MOCK-101',
      nameTh: 'วิชาสมมติ',
      nameEn: null,
      credits: 3,
      creditPattern: '3(3-0-6)',
    },
    ...overrides,
  });
  prisma.curriculumCourse.create.mockResolvedValue(courseRow());
  prisma.curriculumCourse.update.mockResolvedValue(courseRow());
  return {
    service: new CurriculumStructureService(prisma as unknown as PrismaService),
    prisma,
  };
}

const uniqueViolation = Object.assign(new Error('unique'), { code: 'P2002' });

describe('CurriculumStructureService — เขียนโครงสร้างหลักสูตรและแผนการเรียน (ข้อ 2.6)', () => {
  it('หลักสูตรที่ไม่มีตอบ 404 ทุกคำสั่ง', async () => {
    const { service, prisma } = makeService();
    prisma.curriculum.findUnique.mockResolvedValue(null);
    await expect(service.listCourses('NOPE')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.putCreditRule('NOPE', 'CORE', { minCredits: 3 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('เพิ่มรายวิชา: คืนแบบแบนพร้อม courseCode · รหัสวิชาที่ไม่มีตอบ 400 · ซ้ำตอบ 409', async () => {
    const { service, prisma } = makeService();
    const dto: AddCurriculumCourseDto = {
      courseCode: 'MOCK-101',
      category: 'MAJOR_REQUIRED',
      courseGroupId: GROUP_ID,
      recommendedYear: 2,
      recommendedSemester: 1,
    };
    await expect(service.addCourse('MOCK', dto)).resolves.toMatchObject({
      courseCode: 'MOCK-101',
      credits: 3,
      courseGroupId: GROUP_ID,
    });
    expect(prisma.curriculumCourse.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          curriculumId: 'cur-1',
          courseId: 'course-1',
        }) as unknown,
      }),
    );

    prisma.course.findUnique.mockResolvedValueOnce(null);
    await expect(service.addCourse('MOCK', dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    prisma.curriculumCourse.create.mockRejectedValueOnce(uniqueViolation);
    await expect(service.addCourse('MOCK', dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('กลุ่มวิชาของหลักสูตรอื่นใช้ไม่ได้ (400)', async () => {
    const { service } = makeService();
    await expect(
      service.addCourse('MOCK', {
        courseCode: 'MOCK-101',
        category: 'CORE',
        courseGroupId: OTHER_GROUP_ID,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ปีและภาคในแผนต้องมาคู่กัน — รวมกับค่าเดิมตอนแก้', async () => {
    const { service } = makeService();
    await expect(
      service.addCourse('MOCK', {
        courseCode: 'MOCK-101',
        category: 'CORE',
        recommendedYear: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    // เดิมปี 2 ภาค 1 → ล้างแค่ภาค = ไม่คู่
    await expect(
      service.updateCourse('MOCK', 'MOCK-101', { recommendedSemester: null }),
    ).rejects.toBeInstanceOf(BadRequestException);
    // ล้างทั้งคู่ = เอาออกจากแผน
    await expect(
      service.updateCourse('MOCK', 'MOCK-101', {
        recommendedYear: null,
        recommendedSemester: null,
      }),
    ).resolves.toBeDefined();
  });

  it('แก้รายวิชา: ย้ายไปปี 3 · null ของ field ที่ห้ามว่างไม่ถูกส่งไปฐานข้อมูล', async () => {
    const { service, prisma } = makeService();
    await service.updateCourse('MOCK', 'MOCK-101', {
      recommendedYear: 3,
      isRequired: null as unknown as boolean,
    });
    const [[args]] = prisma.curriculumCourse.update.mock.calls as [
      [{ data: Record<string, unknown> }],
    ];
    const { data } = args;
    expect(data).toEqual({ recommendedYear: 3 });
  });

  it('ลบรายวิชาออกจากหลักสูตรได้ · วิชาที่ไม่อยู่ในหลักสูตรตอบ 404', async () => {
    const { service, prisma } = makeService();
    await expect(service.removeCourse('MOCK', 'MOCK-101')).resolves.toEqual({
      courseCode: 'MOCK-101',
      deleted: true,
    });
    expect(prisma.curriculumCourse.delete).toHaveBeenCalledWith({
      where: { id: 'cc-1' },
    });
    prisma.curriculumCourse.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.removeCourse('MOCK', 'MOCK-999'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('ลบกลุ่มวิชาที่ยังมีรายวิชาหรือช่องในแผนตอบ 409 · กลุ่มว่างลบได้', async () => {
    const { service, prisma } = makeService();
    prisma.curriculumCourse.count.mockResolvedValueOnce(4);
    await expect(service.deleteGroup('MOCK', GROUP_ID)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.curriculumCourseGroup.delete).not.toHaveBeenCalled();

    await expect(service.deleteGroup('MOCK', GROUP_ID)).resolves.toEqual({
      id: GROUP_ID,
      deleted: true,
    });
  });

  it('ชื่อกลุ่มซ้ำในหลักสูตรตอบ 409', async () => {
    const { service, prisma } = makeService();
    prisma.curriculumCourseGroup.create.mockRejectedValueOnce(uniqueViolation);
    await expect(
      service.createGroup('MOCK', {
        category: 'CORE',
        parentNameTh: 'หมวดสมมติ',
        nameTh: 'กลุ่มสมมติ',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('เกณฑ์หน่วยกิต: upsert ต่อหมวด (ตัวพิมพ์เล็กได้) · หมวดที่ไม่รู้จักตอบ 400 · ลบที่ไม่มีตอบ 404', async () => {
    const { service, prisma } = makeService();
    await service.putCreditRule('MOCK', 'core', { minCredits: 30 });
    expect(prisma.curriculumCreditRule.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          curriculumId_category: { curriculumId: 'cur-1', category: 'CORE' },
        },
      }),
    );
    await expect(
      service.putCreditRule('MOCK', 'KITCHEN', { minCredits: 1 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.curriculumCreditRule.deleteMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      service.deleteCreditRule('MOCK', 'CORE'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('ช่องวิชาเลือก: ชื่อซ้ำในภาคเดียวกันตอบ 409 · ช่องของหลักสูตรอื่นตอบ 404', async () => {
    const { service, prisma } = makeService();
    const dto: CreatePlanSlotDto = {
      category: 'MAJOR_ELECTIVE',
      recommendedYear: 2,
      recommendedSemester: 2,
      slotCount: 2,
      creditsPerSlot: 3,
      label: 'วิชาเอกเลือก',
    };
    prisma.curriculumPlanSlot.create.mockRejectedValueOnce(uniqueViolation);
    await expect(service.createPlanSlot('MOCK', dto)).rejects.toBeInstanceOf(
      ConflictException,
    );

    prisma.curriculumPlanSlot.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.updatePlanSlot('MOCK', 'slot-x', { slotCount: 3 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('CurriculaController — สิทธิ์ของ endpoint เขียน (B10)', () => {
  const proto = CurriculaController.prototype as unknown as Record<
    string,
    object
  >;
  const routes = Object.getOwnPropertyNames(proto)
    .filter((name) => name !== 'constructor')
    .map((name) => ({
      name,
      handler: proto[name],
      method: Reflect.getMetadata(METHOD_METADATA, proto[name]) as
        RequestMethod | undefined,
      path: Reflect.getMetadata(PATH_METADATA, proto[name]) as
        string | undefined,
    }))
    .filter((r) => r.method !== undefined);

  const editorPaths = [
    ':code/course-groups',
    ':code/course-groups/:groupId',
    ':code/courses',
    ':code/courses/:courseCode',
    ':code/credit-rules/:category',
    ':code/plan-slots',
    ':code/plan-slots/:slotId',
  ];

  it('ทุก route ของโครงสร้าง/แผนใช้ reference:manage และไม่อยู่ใน allowlist ของ token ระบบย่อย', () => {
    const editor = routes.filter((r) => editorPaths.includes(r.path ?? ''));
    expect(editor.length).toBe(14);
    for (const r of editor) {
      expect(Reflect.getMetadata(PERMISSIONS_KEY, r.handler)).toEqual([
        Permission.REFERENCE_MANAGE,
      ]);
      expect(
        Reflect.getMetadata(SUBSYSTEM_TOKEN_ALLOWED_KEY, r.handler),
      ).toBeUndefined();
    }
  });

  it('GET structure และ study-plan เดิมยังอยู่ใน allowlist', () => {
    for (const path of [':code/structure', ':code/study-plan']) {
      const r = routes.find(
        (x) => x.path === path && x.method === RequestMethod.GET,
      );
      expect(r).toBeDefined();
      expect(Reflect.getMetadata(SUBSYSTEM_TOKEN_ALLOWED_KEY, r!.handler)).toBe(
        true,
      );
    }
  });

  it('DTO: ค่าเกินขอบเขตและ field แปลกปลอมถูกปฏิเสธ (ValidationPipe แบบ main.ts)', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    const meta = { type: 'body' as const, metatype: CreatePlanSlotDto };
    await expect(
      pipe.transform(
        {
          category: 'CORE',
          recommendedYear: 9,
          recommendedSemester: 4,
          slotCount: 1,
          creditsPerSlot: 3,
          label: 'x',
        },
        meta,
      ),
    ).rejects.toBeDefined();
    await expect(
      pipe.transform(
        {
          category: 'CORE',
          recommendedYear: 1,
          recommendedSemester: 1,
          slotCount: 1,
          creditsPerSlot: 3,
          label: 'x',
          curriculumId: 'cur-2',
        },
        meta,
      ),
    ).rejects.toBeDefined();
  });
});
