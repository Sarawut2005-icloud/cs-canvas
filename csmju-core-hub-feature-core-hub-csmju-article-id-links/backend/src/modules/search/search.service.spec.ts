import { PrismaService } from '../../database/prisma.service';
import { SearchService } from './search.service';

function makeService() {
  const model = () => ({ findMany: jest.fn().mockResolvedValue([]) });
  const prisma = {
    person: model(),
    subsystem: model(),
    announcement: model(),
    user: model(),
    faculty: model(),
    department: model(),
    building: model(),
    room: model(),
    term: model(),
    course: model(),
    curriculum: model(),
  };
  return {
    service: new SearchService(prisma as unknown as PrismaService),
    prisma,
  };
}

const ADMIN = { id: 'user-001', role: 'admin' };
const STAFF = { id: 'user-003', role: 'staff' };
const LECTURER = { id: 'user-005', role: 'lecturer' };
const STUDENT = { id: 'user-002', role: 'student' };

describe('SearchService (GET /search)', () => {
  it('searches nothing for fewer than two characters', async () => {
    const { service, prisma } = makeService();
    await expect(service.search(' a ', ADMIN)).resolves.toEqual({});
    expect(prisma.person.findMany).not.toHaveBeenCalled();
  });

  it('gives an admin every group', async () => {
    const { service } = makeService();
    const result = await service.search('test', ADMIN);
    expect(Object.keys(result).sort()).toEqual(
      ['announcements', 'people', 'reference', 'subsystems', 'users'].sort(),
    );
  });

  it('gives each role only the groups its permissions allow', async () => {
    const { service } = makeService();
    // staff: people, own subsystems, announcements, reference, users
    expect(Object.keys(await service.search('test', STAFF)).sort()).toEqual(
      ['announcements', 'people', 'reference', 'subsystems', 'users'].sort(),
    );
    // lecturer: no user:read
    expect(Object.keys(await service.search('test', LECTURER)).sort()).toEqual(
      ['announcements', 'people', 'reference', 'subsystems'].sort(),
    );
    // student: reference data only
    expect(Object.keys(await service.search('test', STUDENT))).toEqual([
      'reference',
    ]);
  });

  it('limits staff to their own subsystems, admins to none', async () => {
    const own = makeService();
    await own.service.search('test', STAFF);
    expect(own.prisma.subsystem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ownerId: 'user-003' }) as unknown,
      }),
    );

    const any = makeService();
    await any.service.search('test', ADMIN);
    const [args] = any.prisma.subsystem.findMany.mock.calls[0] as [
      { where: Record<string, unknown> },
    ];
    expect(args.where.ownerId).toBeUndefined();
  });

  it('tags reference rows with their dataset and flattens the role name', async () => {
    const { service, prisma } = makeService();
    prisma.room.findMany.mockResolvedValue([
      { code: 'TB1-402', nameTh: 'ห้อง 402', isActive: true },
    ]);
    prisma.term.findMany.mockResolvedValue([
      { code: '2569-1', isActive: false },
    ]);
    prisma.user.findMany.mockResolvedValue([
      { email: 'a@x.test', username: 'a', role: { name: 'admin' } },
    ]);

    const result = await service.search('test', ADMIN);

    expect(result.reference).toEqual([
      { dataset: 'rooms', code: 'TB1-402', nameTh: 'ห้อง 402', isActive: true },
      {
        dataset: 'academic-terms',
        code: '2569-1',
        nameTh: null,
        isActive: false,
      },
    ]);
    expect(result.users).toEqual([
      { email: 'a@x.test', username: 'a', role: 'admin' },
    ]);
  });
});
