import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { CurriculaService } from './curricula.service';
import { PublicCurriculaController } from './public-curricula.controller';

function makeController() {
  const curricula = {
    list: jest.fn().mockResolvedValue('list'),
    get: jest.fn().mockResolvedValue('get'),
    structure: jest.fn().mockResolvedValue('structure'),
    studyPlan: jest.fn().mockResolvedValue('plan'),
  };
  const controller = new PublicCurriculaController(
    curricula as unknown as CurriculaService,
  );
  return { controller, curricula };
}

describe('PublicCurriculaController (/public/curricula)', () => {
  it('has no guard — it is readable without signing in', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, PublicCurriculaController),
    ).toBeUndefined();
  });

  it('lists active curricula only, whatever the caller asks', async () => {
    const { controller, curricula } = makeController();
    await controller.list({ page: 1, limit: 20, departmentCode: 'CS' });
    expect(curricula.list).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      departmentCode: 'CS',
      includeInactive: false,
      isActive: true,
    });
  });

  it('asks the service for active curricula only on every detail route', async () => {
    const { controller, curricula } = makeController();
    await controller.get('65304010');
    await controller.structure('65304010');
    await controller.studyPlan('65304010');
    for (const fn of [
      curricula.get,
      curricula.structure,
      curricula.studyPlan,
    ]) {
      expect(fn).toHaveBeenCalledWith('65304010', { activeOnly: true });
    }
  });
});

describe('CurriculaService active-only lookups', () => {
  function makeService(row: unknown) {
    const prisma = {
      curriculum: {
        findFirst: jest.fn().mockResolvedValue(row),
        findUnique: jest.fn().mockResolvedValue(row),
      },
    };
    return {
      service: new CurriculaService(prisma as never),
      prisma,
    };
  }

  it('looks an inactive curriculum up as missing (404) for the public site', async () => {
    const { service, prisma } = makeService(null);
    await expect(
      service.get('OLD-1', { activeOnly: true }),
    ).rejects.toMatchObject({ status: 404 });
    expect(prisma.curriculum.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { code: 'OLD-1', isActive: true } }),
    );
  });

  it('keeps returning inactive curricula on the signed-in route', async () => {
    const { service, prisma } = makeService(null);
    await expect(service.get('OLD-1')).rejects.toBeDefined();
    expect(prisma.curriculum.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { code: 'OLD-1' } }),
    );
  });
});

describe('public curriculum code param', () => {
  it('rejects a code that is not ^[A-Z0-9-]{1,50}$ with 400', () => {
    const pipe = Reflect.getMetadata(
      '__routeArguments__',
      PublicCurriculaController,
      'get',
    ) as Record<string, { pipes: { transform: (v: string) => string }[] }>;
    const codePipe = Object.values(pipe)[0].pipes[0];
    expect(codePipe.transform('65304010')).toBe('65304010');
    expect(() => codePipe.transform('lab 1')).toThrow(BadRequestException);
    expect(() => codePipe.transform('../people')).toThrow(BadRequestException);
  });
});
