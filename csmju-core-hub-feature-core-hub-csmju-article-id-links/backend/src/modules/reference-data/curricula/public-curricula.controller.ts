import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Param,
  PipeTransform,
  Query,
} from '@nestjs/common';

import { CurriculaService } from './curricula.service';
import { PublicCurriculaQueryDto } from './dto/public-curricula.query';

/** api-conventions §1: a Core Hub code path param matches this, else 400. */
const CODE = /^[A-Z0-9-]{1,50}$/;

const CurriculumCodePipe: PipeTransform<string, string> = {
  transform(value: string) {
    if (!CODE.test(value)) {
      throw new BadRequestException([
        'code must be upper-case letters, digits and - (at most 50)',
      ]);
    }
    return value;
  },
};

/**
 * `/api/v1/public/curricula` — curricula for the public website, readable
 * without signing in (PM 2026-10-05). Read-only and active curricula only;
 * an inactive one answers 404 as if it did not exist. The app-wide per-IP
 * rate limit applies as to every route.
 *
 * `/curricula` keeps its reference-data contract and still needs a token —
 * this is a separate, narrower door, not that endpoint made public.
 */
@Controller('public/curricula')
export class PublicCurriculaController {
  constructor(private readonly curricula: CurriculaService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=300')
  list(@Query() query: PublicCurriculaQueryDto) {
    return this.curricula.list({
      ...query,
      includeInactive: false,
      isActive: true,
    });
  }

  @Get(':code/structure')
  @Header('Cache-Control', 'public, max-age=300')
  structure(@Param('code', CurriculumCodePipe) code: string) {
    return this.curricula.structure(code, { activeOnly: true });
  }

  @Get(':code/study-plan')
  @Header('Cache-Control', 'public, max-age=300')
  studyPlan(@Param('code', CurriculumCodePipe) code: string) {
    return this.curricula.studyPlan(code, { activeOnly: true });
  }

  @Get(':code')
  @Header('Cache-Control', 'public, max-age=300')
  get(@Param('code', CurriculumCodePipe) code: string) {
    return this.curricula.get(code, { activeOnly: true });
  }
}
