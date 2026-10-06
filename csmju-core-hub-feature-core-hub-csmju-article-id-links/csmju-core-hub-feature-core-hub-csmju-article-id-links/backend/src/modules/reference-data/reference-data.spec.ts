import {
  ArgumentMetadata,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FacultiesService } from './faculties/faculties.service';
import { DepartmentsService } from './departments/departments.service';
import { BuildingsService } from './buildings/buildings.service';
import { RoomsService } from './rooms/rooms.service';
import { AcademicTermsService } from './academic-terms/academic-terms.service';
import { CoursesService } from './courses/courses.service';
import { CurriculaService } from './curricula/curricula.service';
import { UpdateFacultyDto } from './faculties/dto/faculty.dto';
import { UpdateDepartmentDto } from './departments/dto/department.dto';
import { UpdateBuildingDto } from './buildings/dto/building.dto';
import { UpdateRoomDto } from './rooms/dto/room.dto';
import { UpdateAcademicTermDto } from './academic-terms/dto/academic-term.dto';
import { UpdateCourseDto } from './courses/dto/course.dto';
import { UpdateCurriculumDto } from './curricula/dto/curriculum.dto';

interface WhereArgs {
  where: { isActive?: boolean };
}

const updatedAt = new Date('2026-09-25T09:00:00.000Z');

function model() {
  return {
    count: jest.fn<Promise<number>, [unknown]>().mockResolvedValue(0),
    findMany: jest.fn<Promise<unknown[]>, [WhereArgs]>().mockResolvedValue([]),
    findUnique: jest.fn<Promise<unknown>, [unknown]>(),
    findFirst: jest.fn<Promise<unknown>, [unknown]>(),
    create: jest.fn<Promise<unknown>, [unknown]>(),
    update: jest.fn<Promise<unknown>, [unknown]>(),
    updateMany: jest
      .fn<Promise<unknown>, [unknown]>()
      .mockResolvedValue({ count: 1 }),
  };
}

function makePrisma() {
  const prisma = {
    faculty: model(),
    department: model(),
    room: model(),
    building: model(),
    term: model(),
    termEvent: model(),
    course: model(),
    curriculum: model(),
    curriculumCourseGroup: model(),
    curriculumCourse: model(),
    curriculumCreditRule: model(),
    curriculumPlanSlot: model(),
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  return { prisma, as: prisma as unknown as PrismaService };
}

const QUERY = { page: 1, limit: 20, includeInactive: false };

const FACULTY = {
  code: 'SCI-1',
  nameTh: 'คณะวิทยาศาสตร์',
  nameEn: 'Faculty of Science',
  isActive: false,
  updatedAt,
};
const DEPARTMENT = {
  code: 'CS-1',
  nameTh: 'สาขาวิชาวิทยาการคอมพิวเตอร์',
  nameEn: 'Computer Science',
  isActive: false,
  updatedAt,
  faculty: { code: 'SCI-1', nameTh: 'คณะวิทยาศาสตร์' },
};
const BUILDING = {
  code: 'SCI-60-YEARS',
  nameTh: 'ตึก 60 ปี คณะวิทยาศาสตร์',
  nameEn: null,
  latitude: 18.9,
  longitude: 99.0,
  isActive: false,
  updatedAt,
};
const COURSE = {
  code: '10301111-1',
  baseCode: '10301111',
  nameTh: 'การเขียนโปรแกรมเบื้องต้น',
  nameEn: 'Introduction to Programming',
  credits: 3,
  creditPattern: '3(2-3-5)',
  isActive: false,
  updatedAt,
  department: { code: 'CS-1' },
  curriculumCourses: [] as unknown[],
  prerequisites: [] as unknown[],
};
const CURRICULUM = {
  code: '65304010',
  nameTh: 'วท.บ. วิทยาการคอมพิวเตอร์ 2565',
  nameEn: null,
  curriculumYear: 2565,
  totalCredits: 127,
  isActive: false,
  updatedAt,
  department: { code: 'CS-1' },
};
const ROOM = {
  code: 'LAB-1',
  nameTh: 'ห้องปฏิบัติการคอมพิวเตอร์ 1',
  floor: 6,
  capacity: 35,
  roomType: 'LAB',
  facultyCode: 'SCI-1',
  photoUrl: null,
  isActive: false,
  updatedAt,
  building: { code: 'SCI-60-YEARS', nameTh: 'ตึก 60 ปี คณะวิทยาศาสตร์' },
};
const TERM = {
  code: '2569-1',
  academicYear: 2569,
  semester: 1,
  startDate: new Date('2026-06-29T00:00:00.000Z'),
  endDate: new Date('2026-11-02T00:00:00.000Z'),
  isCurrent: true,
  isActive: true,
  updatedAt,
};

describe('Reference data — ทุกชุดทำตามสัญญากลาง', () => {
  const cases = [
    {
      name: 'faculties',
      key: 'faculty' as const,
      row: FACULTY,
      createDto: { code: 'SCI-1', nameTh: 'x', nameEn: 'x' },
      make: (p: PrismaService) => new FacultiesService(p),
    },
    {
      name: 'departments',
      key: 'department' as const,
      row: DEPARTMENT,
      createDto: {
        code: 'CS-1',
        nameTh: 'x',
        nameEn: 'x',
        facultyCode: 'SCI-1',
      },
      make: (p: PrismaService) => new DepartmentsService(p),
    },
    {
      name: 'buildings',
      key: 'building' as const,
      row: BUILDING,
      createDto: { code: 'SCI-60-YEARS', nameTh: 'x' },
      make: (p: PrismaService) => new BuildingsService(p),
    },
    {
      name: 'rooms',
      key: 'room' as const,
      row: ROOM,
      createDto: {
        code: 'LAB-1',
        nameTh: 'x',
        buildingCode: 'SCI-60-YEARS',
        floor: 6,
        roomType: 'LAB',
      },
      make: (p: PrismaService) => new RoomsService(p),
    },
    {
      name: 'academic-terms',
      key: 'term' as const,
      row: { ...TERM, isActive: false },
      createDto: {
        code: '2569-1',
        academicYear: 2569,
        semester: 1,
        startDate: '2026-06-29',
        endDate: '2026-11-02',
      },
      make: (p: PrismaService) => new AcademicTermsService(p),
    },
    {
      name: 'courses',
      key: 'course' as const,
      row: COURSE,
      createDto: {
        code: '10301111-1',
        baseCode: '10301111',
        nameTh: 'x',
        credits: 3,
      },
      make: (p: PrismaService) => new CoursesService(p),
    },
    {
      name: 'curricula',
      key: 'curriculum' as const,
      row: CURRICULUM,
      createDto: {
        code: '65304010',
        nameTh: 'x',
        curriculumYear: 2565,
        departmentCode: 'CS-1',
      },
      make: (p: PrismaService) => new CurriculaService(p),
    },
  ];

  for (const c of cases) {
    describe(c.name, () => {
      it('รายการคืนเฉพาะ isActive: true เมื่อไม่ส่ง includeInactive', async () => {
        const { prisma, as } = makePrisma();
        await c.make(as).list(QUERY);
        expect(prisma[c.key].findMany.mock.calls[0][0].where.isActive).toBe(
          true,
        );
        await c.make(as).list({ ...QUERY, includeInactive: true });
        expect(
          prisma[c.key].findMany.mock.calls[1][0].where.isActive,
        ).toBeUndefined();
      });

      it('isActive=false คืนเฉพาะที่ปิดใช้งาน แม้ส่ง includeInactive มาด้วย', async () => {
        const { prisma, as } = makePrisma();
        await c.make(as).list({
          ...QUERY,
          includeInactive: true,
          isActive: false,
        });
        expect(prisma[c.key].findMany.mock.calls[0][0].where.isActive).toBe(
          false,
        );
      });

      it('/:code คืนข้อมูลที่ปิดใช้งานได้ · ไม่มี id · updatedAt เป็น ISO', async () => {
        const { prisma, as } = makePrisma();
        prisma[c.key].findUnique.mockResolvedValue(c.row);
        const item = await c.make(as).get(c.row.code);
        expect(item.isActive).toBe(false);
        expect(item).not.toHaveProperty('id');
        expect(item.updatedAt).toBe('2026-09-25T09:00:00.000Z');
      });

      it('code ที่ไม่มีตอบ 404', async () => {
        const { prisma, as } = makePrisma();
        prisma[c.key].findUnique.mockResolvedValue(null);
        await expect(c.make(as).get('NOPE')).rejects.toBeInstanceOf(
          NotFoundException,
        );
      });

      it('สร้าง code ซ้ำตอบ 409', async () => {
        const { prisma, as } = makePrisma();
        // ตารางที่ต้องอ้างถึง (คณะ/สาขา/อาคาร) ให้พบเสมอ — ทดสอบเฉพาะ unique violation
        prisma.faculty.findUnique.mockResolvedValue({
          id: 'f1',
          code: 'SCI-1',
        });
        prisma.department.findUnique.mockResolvedValue({ id: 'd1' });
        prisma.building.findUnique.mockResolvedValue({ id: 'b1' });
        prisma[c.key].create.mockRejectedValue({ code: 'P2002' });
        await expect(
          c.make(as).create(c.createDto as never),
        ).rejects.toBeInstanceOf(ConflictException);
      });
    });
  }

  it('PATCH ที่พยายามแก้ code ถูกปฏิเสธ (ValidationPipe แบบเดียวกับ main.ts)', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    });
    for (const metatype of [
      UpdateFacultyDto,
      UpdateDepartmentDto,
      UpdateBuildingDto,
      UpdateRoomDto,
      UpdateAcademicTermDto,
      UpdateCourseDto,
      UpdateCurriculumDto,
    ]) {
      const meta: ArgumentMetadata = { type: 'body', metatype };
      await expect(
        pipe.transform({ code: 'NEW-1' }, meta),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });
});

describe('Reference data — เฉพาะชุด', () => {
  it('rooms: ส่ง building เป็นชื่อ และ buildingCode', async () => {
    const { prisma, as } = makePrisma();
    prisma.room.findUnique.mockResolvedValue(ROOM);
    const room = await new RoomsService(as).get('LAB-1');
    expect(room.building).toBe('ตึก 60 ปี คณะวิทยาศาสตร์');
    expect(room.buildingCode).toBe('SCI-60-YEARS');
  });

  it('rooms: facultyCode ที่ไม่มีตอบ 400', async () => {
    const { prisma, as } = makePrisma();
    prisma.building.findUnique.mockResolvedValue({ id: 'b1' });
    prisma.faculty.findUnique.mockResolvedValue(null);
    await expect(
      new RoomsService(as).create({
        code: 'X-1',
        nameTh: 'x',
        buildingCode: 'B',
        floor: 1,
        roomType: 'LAB',
        facultyCode: 'NOPE',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('academic-terms: วันที่เป็น YYYY-MM-DD', async () => {
    const { prisma, as } = makePrisma();
    prisma.term.findFirst.mockResolvedValue(TERM);
    const term = await new AcademicTermsService(as).current();
    expect(term.startDate).toBe('2026-06-29');
    expect(term.endDate).toBe('2026-11-02');
  });

  it('academic-terms/current: ไม่มีภาคปัจจุบันตอบ 404', async () => {
    const { prisma, as } = makePrisma();
    prisma.term.findFirst.mockResolvedValue(null);
    await expect(new AcademicTermsService(as).current()).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('set-current: ปิดภาคเดิมแล้วเปิดภาคใหม่ใน transaction เดียว', async () => {
    const { prisma, as } = makePrisma();
    prisma.term.findUnique.mockResolvedValue({
      ...TERM,
      code: '2569-2',
      semester: 2,
      isCurrent: false,
    });
    prisma.term.update.mockResolvedValue({
      ...TERM,
      code: '2569-2',
      semester: 2,
      isCurrent: true,
    });
    const result = await new AcademicTermsService(as).setCurrent('2569-2');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.term.updateMany).toHaveBeenCalledWith({
      where: { isCurrent: true, NOT: { code: '2569-2' } },
      data: { isCurrent: false },
    });
    expect(result.isCurrent).toBe(true);
  });

  it('academic-terms: code ต้องตรงกับปีและภาค', async () => {
    const { as } = makePrisma();
    await expect(
      new AcademicTermsService(as).create({
        code: '2569-2',
        academicYear: 2569,
        semester: 1,
        startDate: '2026-06-01',
        endDate: '2026-10-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('departments: ส่ง facultyCode และ faculty · facultyCode ที่ไม่มีตอบ 400', async () => {
    const { prisma, as } = makePrisma();
    prisma.department.findUnique.mockResolvedValue(DEPARTMENT);
    const item = await new DepartmentsService(as).get('CS-1');
    expect(item.facultyCode).toBe('SCI-1');
    expect(item.faculty).toEqual({ code: 'SCI-1', nameTh: 'คณะวิทยาศาสตร์' });

    prisma.faculty.findUnique.mockResolvedValue(null);
    await expect(
      new DepartmentsService(as).create({
        code: 'X-1',
        nameTh: 'x',
        nameEn: 'x',
        facultyCode: 'NOPE',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rooms: กรองตาม buildingCode', async () => {
    const { prisma, as } = makePrisma();
    await new RoomsService(as).list({ ...QUERY, buildingCode: 'SCI-60-YEARS' });
    expect(prisma.room.findMany.mock.calls[0][0].where).toMatchObject({
      building: { code: 'SCI-60-YEARS' },
    });
  });

  it('courses: ส่ง departmentCode · กรอง baseCode/q · departmentCode ที่ไม่มีตอบ 400', async () => {
    const { prisma, as } = makePrisma();
    prisma.course.findUnique.mockResolvedValue(COURSE);
    const item = await new CoursesService(as).get('10301111-1');
    expect(item.departmentCode).toBe('CS-1');
    expect(item).not.toHaveProperty('department');

    await new CoursesService(as).list({
      ...QUERY,
      baseCode: '10301111',
      q: 'โปรแกรม',
    });
    const where = prisma.course.findMany.mock.calls[0][0].where as {
      baseCode?: string;
      OR?: unknown[];
    };
    expect(where.baseCode).toBe('10301111');
    expect(where.OR).toHaveLength(3);

    prisma.department.findUnique.mockResolvedValue(null);
    await expect(
      new CoursesService(as).create({
        code: '10301111-1',
        baseCode: '10301111',
        nameTh: 'x',
        credits: 3,
        departmentCode: 'NOPE',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('curricula: ส่ง departmentCode · departmentCode ที่ไม่มีตอบ 400', async () => {
    const { prisma, as } = makePrisma();
    prisma.curriculum.findUnique.mockResolvedValue(CURRICULUM);
    const item = await new CurriculaService(as).get('65304010');
    expect(item.departmentCode).toBe('CS-1');
    expect(item.curriculumYear).toBe(2565);

    prisma.department.findUnique.mockResolvedValue(null);
    await expect(
      new CurriculaService(as).create({
        code: '65304010',
        nameTh: 'x',
        curriculumYear: 2565,
        departmentCode: 'NOPE',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('courses: กรอง curriculumCode · /:code บอกหลักสูตรที่วิชาอยู่และวิชาบังคับก่อน (ไม่มี id)', async () => {
    const { prisma, as } = makePrisma();
    await new CoursesService(as).list({ ...QUERY, curriculumCode: '65304010' });
    expect(prisma.course.findMany.mock.calls[0][0].where).toMatchObject({
      curriculumCourses: { some: { curriculum: { code: '65304010' } } },
    });

    prisma.course.findUnique.mockResolvedValue({
      ...COURSE,
      curriculumCourses: [
        {
          category: 'CORE',
          isRequired: true,
          choiceGroup: null,
          recommendedYear: 1,
          recommendedSemester: 1,
          curriculum: { code: '65304010' },
          courseGroup: { nameTh: 'วิชาแกน' },
        },
      ],
      prerequisites: [
        { note: null, prerequisiteCourse: { code: '10301110-1' } },
      ],
    });
    const item = await new CoursesService(as).get('10301111-1');
    expect(item.curricula).toEqual([
      {
        curriculumCode: '65304010',
        category: 'CORE',
        courseGroup: 'วิชาแกน',
        isRequired: true,
        choiceGroup: null,
        recommendedYear: 1,
        recommendedSemester: 1,
      },
    ]);
    expect(item.prerequisites).toEqual([{ code: '10301110-1', note: null }]);
    expect(JSON.stringify(item)).not.toMatch(/"id"/);
  });

  it('curricula: /:code/structure และ /:code/study-plan · หลักสูตรที่ไม่มีตอบ 404', async () => {
    const { prisma, as } = makePrisma();
    const brief = (code: string, credits: number) => ({
      code,
      nameTh: code,
      nameEn: null,
      credits,
      creditPattern: null,
    });
    prisma.curriculum.findUnique.mockResolvedValue({ id: 'cur-1' });
    prisma.curriculumCourseGroup.findMany.mockResolvedValue([
      {
        category: 'CORE',
        parentNameTh: null,
        nameTh: 'วิชาแกน',
        listedCredits: 6,
        availableCourseCount: 2,
        courses: [
          {
            isRequired: true,
            recommendedYear: 1,
            recommendedSemester: 1,
            course: brief('A-1', 3),
          },
        ],
      },
    ]);
    prisma.curriculumCreditRule.findMany.mockResolvedValue([
      { category: 'CORE', minCredits: 30 },
    ]);
    const structure = await new CurriculaService(as).structure('65304010');
    expect(structure.groups[0].courses[0]).toMatchObject({
      code: 'A-1',
      isRequired: true,
    });
    expect(structure.creditRules).toEqual([
      { category: 'CORE', minCredits: 30 },
    ]);
    expect(JSON.stringify(structure)).not.toMatch(/"id"/);

    prisma.curriculumCourse.findMany.mockResolvedValue([
      {
        category: 'CORE',
        isRequired: true,
        choiceGroup: null,
        isCountedInPlan: true,
        planNote: null,
        recommendedYear: 1,
        recommendedSemester: 2,
        course: brief('B-1', 3),
      },
      {
        category: 'CORE',
        isRequired: true,
        choiceGroup: null,
        isCountedInPlan: true,
        planNote: null,
        recommendedYear: 1,
        recommendedSemester: 1,
        course: brief('A-1', 3),
      },
    ]);
    prisma.curriculumPlanSlot.findMany.mockResolvedValue([
      {
        label: 'เลือกเสรี',
        category: 'FREE',
        slotCount: 1,
        creditsPerSlot: 3,
        recommendedYear: 1,
        recommendedSemester: 2,
        courseGroup: null,
      },
    ]);
    const plan = await new CurriculaService(as).studyPlan('65304010');
    expect(plan.terms.map((t) => `${t.year}-${t.semester}`)).toEqual([
      '1-1',
      '1-2',
    ]);
    expect(plan.terms[1].totalCredits).toBe(6);
    expect(plan.totalCredits).toBe(9);
    expect(JSON.stringify(plan)).not.toMatch(/"id"/);

    prisma.curriculum.findUnique.mockResolvedValue(null);
    await expect(
      new CurriculaService(as).structure('NOPE'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      new CurriculaService(as).studyPlan('NOPE'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
