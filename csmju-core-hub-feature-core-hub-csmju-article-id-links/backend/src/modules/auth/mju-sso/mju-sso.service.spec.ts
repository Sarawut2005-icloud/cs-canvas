import {
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

import { PrismaService } from '../../../database/prisma.service';
import { AuthService } from '../auth.service';
import { MjuSsoService } from './mju-sso.service';

const SECRET = 'unit-test-secret-that-is-long-enough-32+';
const CODE = 'A'.repeat(32);
const subjectOf = (cid: string) =>
  createHmac('sha256', SECRET).update(cid).digest('hex');

/** First argument of the first `prisma.user.create` call. */
function createArg(mock: jest.Mock): unknown {
  return (mock.mock.calls as unknown[][])[0][0];
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('MjuSsoService', () => {
  let prisma: {
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
    person: { findUnique: jest.Mock; update: jest.Mock };
    role: { findUnique: jest.Mock };
  };
  let auth: { issueSession: jest.Mock; hasPassword: jest.Mock };
  let config: Record<string, string>;
  let service: MjuSsoService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    config = {
      'mju.clientId': 'client-1',
      'mju.tokenUrl': 'https://sso.example/token.aspx',
      'mju.subjectSecret': SECRET,
    };
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        create: jest.fn(),
      },
      person: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
      role: {
        findUnique: jest.fn(({ where }: { where: { name: string } }) =>
          Promise.resolve({ id: `role-${where.name}` }),
        ),
      },
    };
    auth = {
      issueSession: jest
        .fn()
        .mockResolvedValue({ access_token: 'at', refresh_token: 'rt' }),
      hasPassword: jest.fn().mockResolvedValue(false),
    };
    service = new MjuSsoService(
      { get: (key: string) => config[key] } as unknown as ConfigService,
      prisma as unknown as PrismaService,
      auth as unknown as AuthService,
    );
    fetchMock = jest.fn();
    service.fetchImpl = fetchMock;
  });

  it('posts {clientID, code} as JSON to token.aspx without following redirects', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ citizenID: '1234567890123', e_mail: 'x@mju.ac.th' }),
    );
    prisma.user.findUnique.mockResolvedValue({
      id: 'u',
      email: 'x@mju.ac.th',
      username: null,
      role: { name: 'student' },
    });

    await service.signIn(CODE);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://sso.example/token.aspx');
    expect(init.method).toBe('POST');
    expect(init.redirect).toBe('manual');
    expect(JSON.parse(init.body as string)).toEqual({
      clientID: 'client-1',
      code: CODE,
    });
  });

  it('refuses when MJU_CLIENT_ID is not configured', async () => {
    config['mju.clientId'] = '';
    await expect(service.signIn(CODE)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats {status:"fail"} (bad or expired code) as unauthorized', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ status: 'fail', message: 'invalid grant' }),
    );
    await expect(service.signIn(CODE)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('maps upstream failures to 503 (non-2xx, invalid JSON, network)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));
    await expect(service.signIn(CODE)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.reject(new Error('bad json')),
    });
    await expect(service.signIn(CODE)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'));
    await expect(service.signIn(CODE)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('signs in an already-linked account by mju_subject and never stores citizenID', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ citizenID: '1234567890123' }));
    const linked = { id: 'u1', email: 'a@mju.ac.th', role: { name: 'staff' } };
    prisma.user.findUnique.mockImplementation(
      ({ where }: { where: { mjuSubject?: string } }) =>
        Promise.resolve(
          where.mjuSubject === subjectOf('1234567890123') ? linked : null,
        ),
    );

    await service.signIn(CODE);

    expect(auth.issueSession).toHaveBeenCalledWith(linked, 'MJU_SSO');
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(JSON.stringify(prisma.user.findUnique.mock.calls)).not.toContain(
      '1234567890123',
    );
  });

  it('links an existing password account with the same university e-mail', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ citizenID: '1234567890123', e_mail: 'Staff@MJU.ac.th' }),
    );
    prisma.user.findUnique.mockImplementation(
      ({ where }: { where: { email?: string } }) =>
        Promise.resolve(
          where.email === 'staff@mju.ac.th'
            ? {
                id: 'u2',
                email: 'staff@mju.ac.th',
                role: { name: 'staff' },
                mjuSubject: null,
              }
            : null,
        ),
    );
    prisma.user.update.mockResolvedValue({
      id: 'u2',
      email: 'staff@mju.ac.th',
      role: { name: 'staff' },
    });

    await service.signIn(CODE);

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u2' },
        data: { mjuSubject: subjectOf('1234567890123') },
      }),
    );
  });

  it('rejects when the e-mail is already linked to a different MJU identity', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ citizenID: '1234567890123', e_mail: 'x@mju.ac.th' }),
    );
    prisma.user.findUnique.mockImplementation(
      ({ where }: { where: { email?: string } }) =>
        Promise.resolve(
          where.email
            ? {
                id: 'u3',
                email: 'x@mju.ac.th',
                role: { name: 'student' },
                mjuSubject: 'other',
              }
            : null,
        ),
    );
    await expect(service.signIn(CODE)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('creates a lecturer account for staff the registry lists as LECTURER', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ citizenID: '9999999999998', e_mail: 'prof@mju.ac.th' }),
    );
    prisma.person.findUnique.mockResolvedValue({
      id: 'p2',
      personType: 'STAFF',
      staffType: 'LECTURER',
      status: 'ACTIVE',
      coreUserId: null,
      universityEmail: 'prof@mju.ac.th',
    });
    prisma.user.create.mockImplementation(({ data }: { data: object }) =>
      Promise.resolve({ ...data, role: { name: 'lecturer' } }),
    );

    await service.signIn(CODE);

    const { data } = createArg(prisma.user.create) as {
      data: Record<string, unknown>;
    };
    expect(data.roleId).toBe('role-lecturer');
  });

  it('creates a new account with the role from the people registry (STAFF)', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ citizenID: '9999999999999', e_mail: 'lect@mju.ac.th' }),
    );
    prisma.person.findUnique.mockResolvedValue({
      id: 'p1',
      personType: 'STAFF',
      status: 'ACTIVE',
      coreUserId: null,
      universityEmail: 'lect@mju.ac.th',
    });
    prisma.user.create.mockImplementation(({ data }: { data: object }) =>
      Promise.resolve({ ...data, role: { name: 'staff' } }),
    );

    await service.signIn(CODE);

    const { data } = createArg(prisma.user.create) as {
      data: Record<string, unknown>;
    };
    expect(data.roleId).toBe('role-staff');
    expect(data.email).toBe('lect@mju.ac.th');
    expect(data.username).toBe('lect');
    expect(data.passwordHash).toBeNull();
    expect(data.mjuSubject).toBe(subjectOf('9999999999999'));
    expect(prisma.person.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { coreUserId: data.id },
    });
  });

  it('refuses an MJU user who is not in the people registry and creates nothing', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        citizenID: '5555555555555',
        e_mail: 'other-faculty@mju.ac.th',
        studentCode: '6512345678',
      }),
    );

    await expect(service.signIn(CODE)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.person.update).not.toHaveBeenCalled();
    expect(auth.issueSession).not.toHaveBeenCalled();
  });

  it('refuses a person whose registry status is INACTIVE', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ citizenID: '4444444444444', studentCode: '6604106004' }),
    );
    prisma.person.findUnique.mockResolvedValue({
      id: 'p4',
      personType: 'STUDENT',
      status: 'INACTIVE',
      coreUserId: null,
      universityEmail: null,
    });

    await expect(service.signIn(CODE)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('gives a graduated student the alumni role', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ citizenID: '3333333333333', studentCode: '6004106005' }),
    );
    prisma.person.findUnique.mockResolvedValue({
      id: 'p5',
      personType: 'STUDENT',
      status: 'GRADUATED',
      coreUserId: null,
      universityEmail: null,
    });
    prisma.user.create.mockImplementation(({ data }: { data: object }) =>
      Promise.resolve({ ...data, role: { name: 'alumni' } }),
    );

    await service.signIn(CODE);

    const { data } = createArg(prisma.user.create) as {
      data: Record<string, string>;
    };
    expect(data.roleId).toBe('role-alumni');
  });

  it('signs in to the account the CSV import created for the person instead of a second one', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        citizenID: '2222222222222',
        e_mail: '',
        studentCode: '6604106009',
      }),
    );
    prisma.person.findUnique.mockImplementation(
      ({ where }: { where: { personCode?: string; coreUserId?: string } }) =>
        Promise.resolve(
          where.personCode === '6604106009'
            ? {
                id: 'p9',
                personType: 'STUDENT',
                status: 'ACTIVE',
                coreUserId: 'u-import',
                universityEmail: 'mju6604106009@mju.ac.th',
              }
            : where.coreUserId === 'u-import'
              ? { status: 'ACTIVE' }
              : null,
        ),
    );
    const imported = {
      id: 'u-import',
      email: 'mju6604106009@mju.ac.th',
      username: null,
      role: { name: 'student' },
      mjuSubject: null,
    };
    prisma.user.findUnique.mockImplementation(
      ({ where }: { where: { id?: string } }) =>
        Promise.resolve(where.id === 'u-import' ? imported : null),
    );
    prisma.user.update.mockResolvedValue({
      id: 'u-import',
      email: 'mju6604106009@mju.ac.th',
      role: { name: 'student' },
    });

    await service.signIn(CODE);

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u-import' },
        data: { mjuSubject: subjectOf('2222222222222') },
      }),
    );
    expect(auth.issueSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u-import' }),
      'MJU_SSO',
    );
  });

  it('takes over an unlinked account that already has the registry e-mail', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ citizenID: '6666666666666', studentCode: '6604106006' }),
    );
    prisma.person.findUnique.mockImplementation(
      ({ where }: { where: { personCode?: string } }) =>
        Promise.resolve(
          where.personCode
            ? {
                id: 'p6',
                personType: 'STUDENT',
                status: 'ACTIVE',
                coreUserId: null,
                universityEmail: 'mju6604106006@mju.ac.th',
              }
            : null,
        ),
    );
    prisma.user.findUnique.mockImplementation(
      ({ where }: { where: { email?: string } }) =>
        Promise.resolve(
          where.email === 'mju6604106006@mju.ac.th'
            ? {
                id: 'u6',
                email: 'mju6604106006@mju.ac.th',
                username: null,
                role: { name: 'student' },
                mjuSubject: null,
              }
            : null,
        ),
    );
    prisma.user.update.mockResolvedValue({
      id: 'u6',
      email: 'mju6604106006@mju.ac.th',
      role: { name: 'student' },
    });

    await service.signIn(CODE);

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.person.update).toHaveBeenCalledWith({
      where: { id: 'p6' },
      data: { coreUserId: 'u6' },
    });
  });

  it('refuses an already-linked account whose person has become INACTIVE', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ citizenID: '7777777777777' }));
    prisma.user.findUnique.mockImplementation(
      ({ where }: { where: { mjuSubject?: string } }) =>
        Promise.resolve(
          where.mjuSubject
            ? {
                id: 'u7',
                email: 'a@mju.ac.th',
                username: null,
                role: { name: 'student' },
              }
            : null,
        ),
    );
    prisma.person.findUnique.mockResolvedValue({ status: 'INACTIVE' });

    await expect(service.signIn(CODE)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(auth.issueSession).not.toHaveBeenCalled();
  });

  it('uses the registry e-mail as the login e-mail when MJU sends none', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ citizenID: '1111111111111', studentCode: '6604106001' }),
    );
    prisma.person.findUnique.mockResolvedValue({
      id: 'p1',
      personType: 'STUDENT',
      status: 'ACTIVE',
      coreUserId: null,
      universityEmail: 'mju6604106001@mju.ac.th',
    });
    prisma.user.create.mockImplementation(({ data }: { data: object }) =>
      Promise.resolve({ ...data, role: { name: 'student' } }),
    );

    await service.signIn(CODE);

    const { data } = createArg(prisma.user.create) as {
      data: Record<string, string>;
    };
    expect(data.email).toBe('mju6604106001@mju.ac.th');
    expect(data.username).toBe('6604106001');
    // students are looked up in the people registry by their code
    expect(prisma.person.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { personCode: '6604106001' } }),
    );
  });

  it('synthesises <code>@sso.mju.local when neither MJU nor the registry has an e-mail', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        citizenID: '1111111111111',
        e_mail: '',
        studentCode: '6604106001',
      }),
    );
    prisma.person.findUnique.mockResolvedValue({
      id: 'p1',
      personType: 'STUDENT',
      status: 'ACTIVE',
      coreUserId: null,
      universityEmail: null,
    });
    prisma.user.create.mockImplementation(({ data }: { data: object }) =>
      Promise.resolve({ ...data, role: { name: 'student' } }),
    );

    await service.signIn(CODE);

    const { data } = createArg(prisma.user.create) as {
      data: Record<string, string>;
    };
    expect(data.roleId).toBe('role-student');
    expect(data.username).toBe('6604106001');
    expect(data.email).toBe('6604106001@sso.mju.local');
  });

  it('replaces a placeholder handle/e-mail of a linked account with the student code', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ citizenID: '1234567890123', studentCode: '6604106002' }),
    );
    const subject = subjectOf('1234567890123');
    const linked = {
      id: 'u9',
      email: 'mju-abcdef1234567890@sso.mju.local',
      username: 'mju-abcdef1234567890',
      role: { name: 'student' },
    };
    prisma.user.findUnique.mockImplementation(
      ({ where }: { where: { mjuSubject?: string } }) =>
        Promise.resolve(where.mjuSubject === subject ? linked : null),
    );
    prisma.user.update.mockResolvedValue(undefined);

    await service.signIn(CODE);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u9' },
      data: { username: '6604106002', email: '6604106002@sso.mju.local' },
    });
    expect(auth.issueSession).toHaveBeenCalledWith(
      expect.objectContaining({ email: '6604106002@sso.mju.local' }),
      'MJU_SSO',
    );
  });

  it('opens an MJU_SSO session and tells the frontend whether a password is set', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ citizenID: '1234567890123', e_mail: 'x@mju.ac.th' }),
    );
    prisma.user.findUnique.mockResolvedValue({
      id: 'u',
      email: 'x@mju.ac.th',
      username: null,
      role: { name: 'staff' },
    });

    await expect(service.signIn(CODE)).resolves.toEqual({
      access_token: 'at',
      refresh_token: 'rt',
      password_set: false,
    });
    expect(auth.hasPassword).toHaveBeenCalledWith('u');

    auth.hasPassword.mockResolvedValue(true);
    await expect(service.signIn(CODE)).resolves.toMatchObject({
      password_set: true,
    });
  });

  it('leaves a real handle and e-mail of a linked account untouched', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ citizenID: '1234567890123', studentCode: '6604106003' }),
    );
    const linked = {
      id: 'u10',
      email: 'someone@mju.ac.th',
      username: 'someone',
      role: { name: 'staff' },
    };
    prisma.user.findUnique.mockImplementation(
      ({ where }: { where: { mjuSubject?: string } }) =>
        Promise.resolve(where.mjuSubject ? linked : null),
    );

    await service.signIn(CODE);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses to run without a subject secret', async () => {
    config['mju.subjectSecret'] = 'short';
    fetchMock.mockResolvedValue(jsonResponse({ citizenID: '1' }));
    await expect(service.signIn(CODE)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
