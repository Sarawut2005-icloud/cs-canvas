import { Module } from '@nestjs/common';
import { FacultiesController } from './faculties/faculties.controller';
import { FacultiesService } from './faculties/faculties.service';
import { DepartmentsController } from './departments/departments.controller';
import { DepartmentsService } from './departments/departments.service';
import { BuildingsController } from './buildings/buildings.controller';
import { BuildingsService } from './buildings/buildings.service';
import { RoomsController } from './rooms/rooms.controller';
import { RoomsService } from './rooms/rooms.service';
import { AcademicTermsController } from './academic-terms/academic-terms.controller';
import { AcademicTermsService } from './academic-terms/academic-terms.service';
import { CoursesController } from './courses/courses.controller';
import { CoursesService } from './courses/courses.service';
import { CurriculaController } from './curricula/curricula.controller';
import { PublicCurriculaController } from './curricula/public-curricula.controller';
import { CurriculaService } from './curricula/curricula.service';
import { CurriculumStructureService } from './curricula/curriculum-structure.service';

/**
 * ข้อมูลอ้างอิงกลาง (Reference Data) ตามสเปก SHARED_DATA_HANDOFF.md
 * ทุกชุดใช้สัญญาเดียวกัน: GET list/get (reference:read) · POST/PATCH (reference:manage) · ไม่มี DELETE
 * (ยกเว้นรายการในโครงสร้าง/แผนของหลักสูตร — ไม่ใช่ข้อมูลอ้างอิงที่ระบบย่อยเก็บ code จึงลบได้)
 * ครบ 7 ชุด (backoffice เฟส 2): คณะ · สาขา · อาคาร · ห้อง · ภาคการศึกษา · รายวิชา · หลักสูตร
 * เพิ่มชุดใหม่: สร้างโฟลเดอร์ต่อชุด แล้วลงทะเบียนที่นี่ (สเปกข้อ 9)
 */
@Module({
  controllers: [
    FacultiesController,
    DepartmentsController,
    BuildingsController,
    RoomsController,
    AcademicTermsController,
    CoursesController,
    CurriculaController,
    PublicCurriculaController,
  ],
  providers: [
    FacultiesService,
    DepartmentsService,
    BuildingsService,
    RoomsService,
    AcademicTermsService,
    CoursesService,
    CurriculaService,
    CurriculumStructureService,
  ],
})
export class ReferenceDataModule {}
