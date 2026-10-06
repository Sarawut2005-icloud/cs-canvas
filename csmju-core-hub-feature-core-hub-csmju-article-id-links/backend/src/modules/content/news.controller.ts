import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../authorization/permissions.guard';
import { Permissions } from '../authorization/permissions.decorator';
import { Permission } from '../authorization/permission.enum';
import { NewsService } from './news.service';
import { NewsQueryDto } from './dto/news-query.dto';

/**
 * ประกาศ — ทุก role อ่านได้ (content:read)
 * ไม่ใส่ Cache-Control แบบ reference data เพราะประกาศเปลี่ยนบ่อยกว่า
 */
@Controller('news')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions(Permission.CONTENT_READ)
export class NewsController {
  constructor(private readonly news: NewsService) {}

  @Get()
  async list(@Query() query: NewsQueryDto) {
    return this.news.list(query);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.news.get(id);
  }
}
