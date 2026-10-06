import { Controller, Get, Post, Param } from '@nestjs/common';

@Controller('equipment-items')
export class EquipmentItemsController {
  @Get()
  findAll() {
    return { success: true, data: [], meta: { page: 1, limit: 20, total: 0 } };
  }

  // ชื่อ path parameter เป็น camelCase ได้ — URL ที่ render ออกมายังเป็น kebab-case
  @Post(':id/borrow-requests/:requestId/approve')
  approve(@Param('requestId') requestId: string) {
    return { success: true, data: { requestId } };
  }
}
