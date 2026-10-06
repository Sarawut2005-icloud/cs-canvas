import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { PeopleController } from './people.controller';
import { PeopleImportService } from './people-import.service';
import { PeopleService } from './people.service';

/**
 * ทะเบียนบุคคล (/api/v1/people) — แยกจากบัญชี login ของ Core Hub (Person.coreUserId)
 * อ่านข้อมูล · นำเข้า CSV · แก้สถานะ/ผูกบัญชี (people:manage) อยู่ในโมดูลนี้ทั้งหมด
 * UsersModule: CSV import สร้างบัญชีให้นักศึกษาใหม่ตามกติกาใน UsersService
 */
@Module({
  imports: [UsersModule],
  controllers: [PeopleController],
  providers: [PeopleImportService, PeopleService],
  exports: [PeopleService],
})
export class PeopleModule {}
