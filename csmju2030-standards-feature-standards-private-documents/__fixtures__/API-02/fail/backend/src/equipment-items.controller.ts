import { Controller, Get } from '@nestjs/common';

@Controller('equipment-items')
export class EquipmentItemsController {
  @Get()
  findAll() {
    return { success: true, data: [], meta: { page: 1, per_page: 20, total: 0 } };
  }
}
