import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';
import { SearchService } from './search.service';

/**
 * `GET /api/v1/search?q=` — the backoffice header search in one request.
 * Signed in only; the service searches each group under the permission its
 * own list endpoint requires and leaves out groups the caller may not read.
 * Personal data inside: never cached.
 */
@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  search(@Query('q') q: unknown, @CurrentUser() user: AuthenticatedUser) {
    return this.searchService.search(typeof q === 'string' ? q : '', user);
  }
}
