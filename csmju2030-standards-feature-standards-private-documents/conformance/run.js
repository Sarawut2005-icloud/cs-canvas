#!/usr/bin/env node
'use strict';
/**
 * CSMJU2030 Subsystem Conformance Runner
 * =====================================
 *
 * Black-box conformance test for any subsystem, in any language or framework.
 * It only speaks HTTP to the candidate subsystem and to the Core Hub.
 *
 *   node conformance/run.js --manifest ./csmju-subsystem.json
 *   node conformance/run.js --url http://localhost:3002 --subsystem equipment-service
 *
 * Levels
 *   L1  Identity  - Core Hub token verification, 401 behaviour, /me, no local login
 *   L2  Contract  - response envelope, error codes, pagination, 400/403/404
 *   L3  SSO       - registered callback_url, sign-in that starts at /auth/login, the
 *                   three callback outcomes, session without re-login, logout
 *
 * L3 plays Core Hub's web app itself: after the subsystem's /auth/login it
 * calls the API's sso/authorize with a Bearer token and the subsystem's state,
 * which is what the web app does with its session cookie.
 *
 * Accounts come from the JSON file named by CONFORMANCE_ACCOUNTS_FILE, kept
 * outside the repo; without it only a Core Hub on localhost falls back to its
 * seed accounts (lib/accounts.js). Each account logs in once per run.
 *
 * A 429 with Retry-After of at most 5 s is waited out and retried once (never
 * for a login); the summary counts retries, and error codes outside
 * contracts/error-codes.json are listed as WARN (they will FAIL in the next
 * version). Any FAIL or SKIP makes the run NOT CONFORMANT.
 *
 * Exit codes: 0 conformant · 1 not conformant · 2 the run could not start.
 *
 * Zero dependencies: Node.js 20+ only. Never reads the Core Hub private key,
 * never prints a password or a token.
 */
const fs = require('node:fs');
const path = require('node:path');

const { loadManifest } = require('./lib/manifest');
const {
  ACCOUNTS_ENV,
  OWNER,
  ROLES,
  loginAll,
  repoRootsFor,
  resolveAccounts,
} = require('./lib/accounts');
const {
  Report,
  call,
  cookieByName,
  cookiePair,
  shownCookie,
  deletesCookie,
  isSuccessEnvelope,
  isErrorEnvelope,
  isKnownErrorCode,
  leaksInternals,
  observations,
} = require('./lib/harness');
const { negativeTokens, decodeJwt } = require('./lib/tokens');

const JWT_CONTRACT = require('../contracts/jwt-contract.json');

// ---------------------------------------------------------------- config --

function parseArgs(argv) {
  const args = {};

  for (let i = 2; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current.startsWith('--')) continue;

    const key = current.slice(2);
    const next = argv[i + 1];

    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }

  return args;
}

/** subsystem-registry.md ข้อ 2 — ชื่อเดียวกับ SUBSYSTEM_ID และทะเบียน · คุกกี้ SSO ตั้งชื่อตามนี้ */
const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const NAME_MAX_LENGTH = 64;

function loadConfig(args) {
  // แหล่งเดียวคือ subsystem.yaml ที่รากของ repo (ไฟล์เดียวกับที่ CI ใช้)
  const { manifest, manifestPath } = loadManifest(args.manifest);

  if (manifestPath) {
    console.log(`manifest      : ${manifestPath}`);
  }

  const config = {
    subsystemId: args.subsystem ?? manifest.subsystemId,
    baseUrl: (args.url ?? manifest.baseUrl ?? '').replace(/\/+$/, ''),
    coreHubUrl: (args['core-hub'] ?? manifest.coreHubUrl ?? 'http://localhost:3000').replace(/\/+$/, ''),
    coreHubWebUrl: (args['core-hub-web'] ?? manifest.coreHubWebUrl ?? '').replace(/\/+$/, ''),
    level: (args.level ?? manifest.level ?? 'L3').toUpperCase(),
    callbackPath: manifest.callbackPath ?? '/auth/callback',
    probes: manifest.probes ?? {},
    manifestPath,
    loginFailures: {},
    json: Boolean(args.json),
  };

  if (!config.baseUrl) throw new Error('ต้องระบุ --url หรือ base_url ใน subsystem.yaml');
  if (!config.subsystemId) throw new Error('ต้องระบุ --subsystem หรือ name ใน subsystem.yaml');

  const id = String(config.subsystemId);
  if (!NAME_PATTERN.test(id) || id.length > NAME_MAX_LENGTH) {
    throw new Error(
      `ชื่อระบบ "${id}" ผิดรูปแบบ — ใช้ a-z 0-9 คั่นด้วย - ยาว 1–${NAME_MAX_LENGTH} ตัว เช่น csmju-equipment ` +
        '(subsystem-registry.md ข้อ 2)',
    );
  }
  config.subsystemId = id;

  return config;
}

// ------------------------------------------------------------- level 1 ----

async function runLevel1(config, report, tokens) {
  const { baseUrl } = config;
  const anyToken =
    tokens.staff ?? tokens.admin ?? tokens.student ?? tokens.alumni ?? tokens.lecturer ?? tokens.guest;

  report.group('L1 · Identity — health & public surface');

  const health = await call(`${baseUrl}/api/health`);

  if (health.status === 0) {
    throw new Error(
      `ไม่สามารถเชื่อมต่อ subsystem ที่ ${baseUrl} ได้ (${health.error}). ` +
        'ตรวจว่ารันระบบอยู่และ baseUrl ถูกต้องหรือยัง',
    );
  }

  report.expect('L1-01', 'GET /api/health → 200', health.status, 200);
  report.expectTrue(
    'L1-02',
    'health uses the success envelope',
    isSuccessEnvelope(health.body),
    `body=${JSON.stringify(health.body)?.slice(0, 120)}`,
  );
  report.expect(
    'L1-03',
    'health reports status "ok"',
    health.body?.data?.status,
    'ok',
  );
  report.expect(
    'L1-04',
    'health reports the registered subsystem id',
    health.body?.data?.service,
    config.subsystemId,
  );

  for (const [id, routePath] of [
    ['L1-05', '/api/v1/auth/login'],
    ['L1-06', '/api/v1/login'],
    ['L1-07', '/api/v1/auth/register'],
  ]) {
    const response = await call(`${baseUrl}${routePath}`, {
      method: 'POST',
      json: { email: 'x@y.local', password: 'password1' },
    });

    report.expectTrue(
      id,
      `no local login endpoint at POST ${routePath}`,
      response.status === 404 || response.status === 405,
      `got ${response.status} - a subsystem MUST NOT authenticate users itself`,
    );
  }

  report.group('L1 · Identity — /api/v1/me with a real Core Hub token');

  const me = await call(`${baseUrl}/api/v1/me`, { token: anyToken });
  report.expect('L1-08', 'GET /api/v1/me → 200', me.status, 200);
  report.expectTrue('L1-09', '/me uses the success envelope', isSuccessEnvelope(me.body));

  const claims = anyToken ? decodeJwt(anyToken).payload : {};

  report.expect('L1-10', '/me.id equals the token subject', me.body?.data?.id, claims.sub);
  report.expect('L1-11', '/me.coreRole equals the token role', me.body?.data?.coreRole, claims.role);
  report.expectTrue(
    'L1-12',
    '/me.subsystemRole is a mapped, non-empty value',
    typeof me.body?.data?.subsystemRole === 'string' && me.body.data.subsystemRole.length > 0,
    `got ${JSON.stringify(me.body?.data?.subsystemRole)}`,
  );

  report.group('L1 · Identity — every rejected token must answer 401');

  const noToken = await call(`${baseUrl}/api/v1/me`);
  report.expect('L1-13', 'no token → 401', noToken.status, 401);
  report.expectTrue('L1-14', 'error envelope on 401', isErrorEnvelope(noToken.body));
  report.expect('L1-15', 'error code is UNAUTHORIZED', noToken.body?.error?.code, 'UNAUTHORIZED');

  const basicAuth = await call(`${baseUrl}/api/v1/me`, {
    headers: { authorization: 'Basic dXNlcjpwYXNz' },
  });
  report.expect('L1-16', 'non-Bearer scheme → 401', basicAuth.status, 401);

  const negatives = negativeTokens(JWT_CONTRACT, anyToken);
  const negativeCases = [
    ['L1-17', 'malformed token', negatives.malformed],
    ['L1-18', 'expired token', negatives.expired],
    ['L1-19', 'wrong issuer', negatives.wrongIssuer],
    ['L1-20', 'wrong audience', negatives.wrongAudience],
    ['L1-21', 'unknown kid', negatives.unknownKid],
    ['L1-22', 'signature from a foreign key', negatives.foreignSignature],
    ['L1-23', 'missing sub claim', negatives.missingSubject],
    ['L1-24', 'alg=none (unsigned)', negatives.algNone],
    ['L1-25', 'HS256 token', negatives.hs256],
    ['L1-26', 'tampered role claim', negatives.tamperedRole],
    ['L1-27', 'tampered sub claim', negatives.tamperedSubject],
  ];

  for (const [id, title, token] of negativeCases) {
    if (!token) {
      report.skip(id, title, 'no valid token available to derive this case');
      continue;
    }

    const response = await call(`${baseUrl}/api/v1/me`, { token });
    report.expect(id, `${title} → 401`, response.status, 401);
  }

  report.group('L1 · Identity — role mapping and error hygiene');

  for (const [role, token] of Object.entries(tokens)) {
    if (!token) continue;

    const response = await call(`${baseUrl}/api/v1/me`, { token });
    const accepted = response.status === 200;
    const refused = response.status === 403;

    report.expectTrue(
      `L1-28.${role}`,
      `core role "${role}" is mapped (200) or explicitly refused (403)`,
      accepted || refused,
      `got ${response.status}`,
    );

    if (refused) {
      report.expectTrue(
        `L1-29.${role}`,
        `refusal for "${role}" uses FORBIDDEN`,
        response.body?.error?.code === 'FORBIDDEN',
        `got ${JSON.stringify(response.body?.error)}`,
      );
    }
  }

  // A role whose account is in the accounts file but gave no token went untested.
  for (const [role, problem] of Object.entries(config.loginFailures)) {
    if (role === OWNER || tokens[role]) continue;
    report.skip(
      `L1-28.${role}`,
      `core role "${role}" is mapped (200) or explicitly refused (403)`,
      `the account in ${ACCOUNTS_ENV} gave no token - ${problem}`,
    );
  }

  const leak = await call(`${baseUrl}/api/v1/me`, { token: negatives.malformed });
  report.expectTrue(
    'L1-30',
    'error responses do not leak stack traces or internals',
    !leaksInternals(leak.text),
    (leak.text ?? '').slice(0, 160),
  );
}

// ------------------------------------------------------------- level 2 ----

async function runLevel2(config, report, tokens) {
  const { baseUrl, probes } = config;
  const staffToken = tokens.staff ?? tokens.admin;

  report.group('L2 · Contract — collection shape & pagination');

  if (!staffToken) {
    report.skip(
      'L2-01',
      'contract probes (L2-01 – L2-15)',
      `no staff or admin token - add a "staff" account to ${ACCOUNTS_ENV}`,
    );
    return;
  }

  if (!probes.collection) {
    report.skip('L2-01', 'collection endpoint', 'manifest.probes.collection is not declared');
  } else {
    const collection = await call(`${baseUrl}${probes.collection}`, { token: staffToken });

    report.expect('L2-01', `GET ${probes.collection} → 200`, collection.status, 200);
    report.expectTrue(
      'L2-02',
      'collection returns data as an array',
      Array.isArray(collection.body?.data),
      `got ${typeof collection.body?.data}`,
    );

    const meta = collection.body?.meta ?? {};
    report.expectTrue(
      'L2-03',
      'collection returns meta{total,page,limit,totalPages}',
      ['total', 'page', 'limit', 'totalPages'].every((key) => typeof meta[key] === 'number'),
      `meta=${JSON.stringify(meta)}`,
    );

    const paginated = await call(`${baseUrl}${probes.collection}?page=1&limit=1`, {
      token: staffToken,
    });
    report.expectTrue(
      'L2-04',
      'pagination honours ?page=1&limit=1',
      paginated.status === 200 &&
        Array.isArray(paginated.body?.data) &&
        paginated.body.data.length <= 1 &&
        paginated.body?.meta?.limit === 1,
      `status=${paginated.status} len=${paginated.body?.data?.length} meta=${JSON.stringify(paginated.body?.meta)}`,
    );

    const badQuery = await call(`${baseUrl}${probes.collection}?limit=not-a-number`, {
      token: staffToken,
    });
    report.expect('L2-05', 'invalid query parameter → 400', badQuery.status, 400);
    report.expect(
      'L2-06',
      'invalid query uses VALIDATION_ERROR',
      badQuery.body?.error?.code,
      'VALIDATION_ERROR',
    );
  }

  report.group('L2 · Contract — 404 / 400 / 403');

  if (probes.notFound) {
    const missing = await call(`${baseUrl}${probes.notFound}`, { token: staffToken });
    report.expect('L2-07', 'unknown resource id → 404', missing.status, 404);
    report.expect('L2-08', '404 uses NOT_FOUND', missing.body?.error?.code, 'NOT_FOUND');
  } else {
    report.skip('L2-07', 'unknown resource id → 404', 'manifest.probes.notFound is not declared');
  }

  if (probes.invalidId) {
    const invalid = await call(`${baseUrl}${probes.invalidId}`, { token: staffToken });
    report.expect('L2-09', 'malformed resource id → 400', invalid.status, 400);
  } else {
    report.skip('L2-09', 'malformed resource id → 400', 'manifest.probes.invalidId is not declared');
  }

  const create = probes.create;

  if (create?.path) {
    const allowedToken = tokens[create.allowedRole ?? 'staff'] ?? staffToken;
    const deniedToken = tokens[create.deniedRole ?? 'student'];

    const invalidBody = await call(`${baseUrl}${create.path}`, {
      method: 'POST',
      token: allowedToken,
      json: create.invalidBody ?? { unknownField: 'x' },
    });
    report.expect('L2-10', 'invalid request body → 400', invalidBody.status, 400);
    report.expect(
      'L2-11',
      'invalid body uses VALIDATION_ERROR',
      invalidBody.body?.error?.code,
      'VALIDATION_ERROR',
    );

    if (deniedToken) {
      const denied = await call(`${baseUrl}${create.path}`, {
        method: 'POST',
        token: deniedToken,
        json: create.validBody ?? create.invalidBody ?? {},
      });
      report.expect(
        'L2-12',
        `role "${create.deniedRole ?? 'student'}" cannot write → 403`,
        denied.status,
        403,
      );
      report.expect('L2-13', 'denied write uses FORBIDDEN', denied.body?.error?.code, 'FORBIDDEN');
    } else {
      const deniedRole = create.deniedRole ?? 'student';
      const loginProblem = config.loginFailures[deniedRole];
      report.skip(
        'L2-12',
        'denied write → 403',
        loginProblem
          ? `the account for the denied role "${deniedRole}" gave no token - ${loginProblem}`
          : `no token for the denied role "${deniedRole}" - add that account to ${ACCOUNTS_ENV}, ` +
              'or set probes.create.denied_role to a role that has one (guest or alumni on the real Core Hub)',
      );
    }
  } else {
    report.skip('L2-10', 'write probes', 'manifest.probes.create is not declared');
  }

  report.group('L2 · Contract — error codes come from the closed enum');

  const observed = new Set(
    report.results
      .map((result) => result.detail)
      .join(' ')
      .match(/[A-Z_]{4,}/g) ?? [],
  );

  const unknownRoute = await call(`${baseUrl}/api/v1/__does_not_exist__`, { token: staffToken });
  report.expectTrue(
    'L2-14',
    'unknown route → 404 with an error envelope',
    unknownRoute.status === 404 && isErrorEnvelope(unknownRoute.body),
    `status=${unknownRoute.status} body=${JSON.stringify(unknownRoute.body)?.slice(0, 120)}`,
  );
  report.expectTrue(
    'L2-15',
    'every returned error code is part of the standard enum',
    !unknownRoute.body?.error?.code || isKnownErrorCode(unknownRoute.body.error.code),
    `code=${unknownRoute.body?.error?.code} observed=${[...observed].join(',')}`,
  );
}

// ------------------------------------------------------------- level 3 ----

/** Cookie names are the subsystem name with "-" turned into "_" (auth-contract 5.1-5.2). */
function ssoCookieNames(subsystemId) {
  const prefix = subsystemId.replace(/-/g, '_');
  return {
    session: `${prefix}${JWT_CONTRACT.sso.sessionCookieSuffix}`,
    state: `${prefix}${JWT_CONTRACT.sso.stateCookieSuffix}`,
  };
}

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/** Location without the access token, safe to print. */
function shown(location) {
  return (location ?? '').replace(/access_token=[^&]+/, 'access_token=<token>');
}

/**
 * The registry, read with the admin token when there is one (GET /subsystems/all,
 * every registration), otherwise with the owner account through the paginated
 * list GET /subsystems?q=<name>, which Core Hub narrows to the caller's own
 * registrations and filters by name or display name (contains, any case).
 */
async function readRegistry(config, tokens, ownerToken) {
  const { coreHubUrl, subsystemId } = config;

  if (tokens.admin) {
    const route = '/api/v1/subsystems/all';
    const response = await call(`${coreHubUrl}${route}`, { token: tokens.admin, redirect: 'follow' });
    return { reader: 'admin', route, response, entries: response.body?.data ?? response.body ?? [] };
  }

  if (ownerToken) {
    const route = `/api/v1/subsystems?${new URLSearchParams({ q: subsystemId, limit: '100' })}`;
    const response = await call(`${coreHubUrl}${route}`, { token: ownerToken, redirect: 'follow' });
    return { reader: 'owner', route, response, entries: response.body?.data ?? [] };
  }

  return null;
}

async function runLevel3(config, report, tokens, ownerToken) {
  const { baseUrl, coreHubUrl, coreHubWebUrl, subsystemId, callbackPath } = config;
  const sso = JWT_CONTRACT.sso;
  const names = ssoCookieNames(subsystemId);

  report.group('L3 · SSO — registration');

  const registry = await readRegistry(config, tokens, ownerToken);

  if (!registry) {
    report.skip(
      'L3-01',
      'subsystem registration',
      config.loginFailures[OWNER]
        ? `no Core Hub admin token, and the owner account gave no token - ${config.loginFailures[OWNER]}`
        : `no Core Hub admin or owner token - add the account that registered the subsystem as "owner" in ${ACCOUNTS_ENV}`,
    );
    return;
  }

  const entry = Array.isArray(registry.entries)
    ? registry.entries.find((item) => item?.name === subsystemId)
    : undefined;

  if (!entry) {
    report.fail(
      'L3-01',
      'subsystem is registered in the Subsystem Registry',
      `"${subsystemId}" not found - read as ${registry.reader}: GET ${registry.route} → ${registry.response.status}` +
        (registry.reader === 'owner' ? ' (the owner account sees only the subsystems it registered)' : ''),
    );
    return;
  }

  report.pass('L3-01', 'subsystem is registered in the Subsystem Registry');
  report.expect('L3-02', 'registry approvalStatus is APPROVED', entry.approvalStatus, 'APPROVED');
  report.expect('L3-03', 'registry status is ACTIVE', entry.status, 'ACTIVE');
  report.expect(
    'L3-04',
    'registered callback_url matches the running subsystem',
    (entry.callbackUrl ?? '').replace(/\/+$/, ''),
    `${baseUrl}${callbackPath}`,
  );

  const mappedRoles = Object.keys(entry.defaultRoleMapping ?? {});
  report.expectTrue(
    'L3-05',
    'registry declares the core roles this subsystem accepts',
    mappedRoles.length > 0,
    'defaultRoleMapping is empty - Core Hub cannot filter who may enter',
  );

  // The mapping keys are Core Hub's access list; an empty mapping lets every role in.
  const ssoRole =
    mappedRoles.length > 0
      ? mappedRoles.find((role) => tokens[role])
      : ['staff', ...ROLES].find((role) => tokens[role]);
  const ssoToken = ssoRole ? tokens[ssoRole] : undefined;

  /** Step 1, as a browser: the subsystem mints a state and points at Core Hub web. */
  const beginLogin = async (next) => {
    const query = next === undefined ? '' : `?next=${encodeURIComponent(next)}`;
    const response = await call(`${baseUrl}${sso.subsystemLoginPath}${query}`);
    const target = parseUrl(response.location);
    const stateCookie = cookieByName(response, names.state);
    return {
      response,
      target,
      state: target?.searchParams.get('state') ?? null,
      stateCookie,
      cookie: cookiePair(stateCookie),
    };
  };

  /** Step 2, as Core Hub's web app: the API handoff with the user's Bearer token. */
  const handoff = (state) => {
    const query = new URLSearchParams({ subsystem: subsystemId });
    if (state !== undefined) query.set('state', state);
    return call(`${coreHubUrl}${JWT_CONTRACT.ssoAuthorizePath}?${query}`, { token: ssoToken });
  };

  /** Step 3, as a browser: follow Core Hub's redirect back, with or without a cookie. */
  const callback = (location, cookie) => call(location, cookie ? { cookie } : {});

  const withToken = (location, token) => {
    const url = new URL(location);
    url.searchParams.set('access_token', token);
    return url.toString();
  };

  report.group('L3 · SSO — /auth/login starts every sign-in');

  const login = await beginLogin();
  const expectedAuthorize = coreHubWebUrl ? `${coreHubWebUrl}${sso.coreHubWebAuthorizePath}` : '';

  if (!coreHubWebUrl) {
    report.fail('L3-16', `${sso.subsystemLoginPath} → 302 to Core Hub web /sso/authorize`, 'manifest ไม่มี core_hub_web_url');
  } else {
    report.expectTrue(
      'L3-16',
      `${sso.subsystemLoginPath} → 302 to Core Hub web /sso/authorize with subsystem and state`,
      login.response.status === 302 &&
        login.target !== null &&
        `${login.target.origin}${login.target.pathname}` === expectedAuthorize &&
        login.target.searchParams.get('subsystem') === subsystemId &&
        Boolean(login.state) &&
        !login.target.searchParams.has('callback_url'),
      `status=${login.response.status} location=${shown(login.response.location) || '(none)'}`,
    );
  }

  const stateMaxAge = Number(/max-age=(\d+)/i.exec(login.stateCookie ?? '')?.[1]);
  report.expectTrue(
    'L3-17',
    `${sso.subsystemLoginPath} sets an HttpOnly ${names.state} lasting at most ${sso.stateTtlMaxSec} s`,
    Boolean(login.stateCookie) &&
      /httponly/i.test(login.stateCookie) &&
      Number.isFinite(stateMaxAge) &&
      stateMaxAge > 0 &&
      stateMaxAge <= sso.stateTtlMaxSec,
    `set-cookie=${login.stateCookie ?? '(none)'}`,
  );

  if (!ssoToken) {
    report.skip(
      'L3-06',
      'SSO handoff, callbacks and sign-out (L3-06 – L3-15, L3-18 – L3-22)',
      `no token for a role in defaultRoleMapping (${mappedRoles.join(', ')}) - add one of these accounts to ${ACCOUNTS_ENV}`,
    );
    return;
  }

  report.group('L3 · SSO — handoff with the subsystem state');

  const authorize = await handoff(login.state ?? undefined);

  report.expect('L3-06', 'Core Hub SSO authorize (with state) → 302', authorize.status, 302);
  report.expectTrue(
    'L3-07',
    'redirect points at the registered callback and returns the state',
    (authorize.location ?? '').startsWith(`${baseUrl}${callbackPath}`) &&
      parseUrl(authorize.location)?.searchParams.get('state') === login.state,
    `location=${shown(authorize.location)}`,
  );

  report.group('L3 · SSO — callback establishes a session');

  if (!authorize.location) {
    report.skip('L3-08', 'callback accepts the handoff', 'no redirect location to follow');
    return;
  }

  const accepted = await callback(authorize.location, login.cookie);
  const session = cookieByName(accepted, names.session);

  report.expect('L3-08', 'callback with a matching state → 302', accepted.status, 302);
  report.expectTrue(
    'L3-09',
    `callback sets an HttpOnly ${names.session} cookie`,
    Boolean(session) && !deletesCookie(session) && /httponly/i.test(session),
    `set-cookie=${accepted.setCookies.map((entry) => entry.split(';')[0].split('=')[0]).join(', ') || '(none)'}`,
  );

  if (session && !deletesCookie(session)) {
    const meViaCookie = await call(`${baseUrl}/api/v1/me`, { cookie: cookiePair(session) });
    report.expect('L3-10', 'the session cookie alone reaches /api/v1/me', meViaCookie.status, 200);

    const claims = decodeJwt(ssoToken).payload;
    report.expect(
      'L3-11',
      'cookie session identifies the same Core Hub user',
      meViaCookie.body?.data?.id,
      claims.sub,
    );
  } else {
    report.skip('L3-10', 'session cookie reaches /api/v1/me', 'no cookie was issued');
    report.skip('L3-11', 'cookie session identifies the same user', 'no cookie was issued');
  }

  report.group('L3 · SSO — callbacks that must not create a session');

  const setsSession = (result) => {
    const entry = cookieByName(result, names.session);
    return Boolean(entry) && !deletesCookie(entry);
  };

  // A forged token, with a valid state and cookie so the check reaches the token.
  const negatives = negativeTokens(JWT_CONTRACT, ssoToken);
  const forgedLogin = await beginLogin();
  const forgedAuthorize = await handoff(forgedLogin.state ?? undefined);
  const tampered = forgedAuthorize.location
    ? await callback(withToken(forgedAuthorize.location, negatives.tamperedRole), forgedLogin.cookie)
    : { status: 0, setCookies: [] };
  report.expect('L3-12', 'callback with a tampered token (state valid) → 401', tampered.status, 401);
  report.expectTrue(
    'L3-13',
    'no session cookie is issued for a rejected token',
    !setsSession(tampered),
    `set-cookie=${tampered.setCookies.map(shownCookie).join(' | ') || '(none)'}`,
  );

  const noToken = await call(`${baseUrl}${callbackPath}`);
  report.expectTrue(
    'L3-14',
    'callback without a token → 400 or 401',
    noToken.status === 400 || noToken.status === 401,
    `got ${noToken.status}`,
  );

  const foreignCallback = await call(
    `${coreHubUrl}${JWT_CONTRACT.ssoAuthorizePath}?subsystem=${encodeURIComponent(subsystemId)}` +
      `&callback_url=${encodeURIComponent('https://evil.example.com/steal')}`,
    { token: ssoToken },
  );
  report.expect('L3-15', 'Core Hub rejects an unregistered callback_url', foreignCallback.status, 400);

  // A sidebar click: Core Hub starts the sign-in, so there is no state.
  const stateless = await handoff(undefined);
  const restarted = stateless.location ? await callback(stateless.location) : { status: 0, setCookies: [] };
  const restartTarget = parseUrl(restarted.location ? new URL(restarted.location, baseUrl) : '');
  report.expectTrue(
    'L3-18',
    `callback without state → 302 to ${sso.subsystemLoginPath}, no session cookie`,
    restarted.status === 302 &&
      restartTarget?.pathname === sso.subsystemLoginPath &&
      !setsSession(restarted),
    `status=${restarted.status} location=${shown(restarted.location) || '(none)'}`,
  );

  // A state that arrives without its cookie: this browser never started it.
  const orphanLogin = await beginLogin();
  const orphanAuthorize = await handoff(orphanLogin.state ?? undefined);
  const orphan = orphanAuthorize.location ? await callback(orphanAuthorize.location) : { status: 0, setCookies: [] };
  report.expectTrue(
    'L3-19',
    'callback with a state but no state cookie → 401, no session cookie',
    orphan.status === 401 && !setsSession(orphan),
    `status=${orphan.status}`,
  );

  // The state of one sign-in with the cookie of another.
  const first = await beginLogin();
  const second = await beginLogin();
  const crossed = await handoff(first.state ?? undefined);
  const mismatched = crossed.location ? await callback(crossed.location, second.cookie) : { status: 0, setCookies: [] };
  report.expectTrue(
    'L3-20',
    'state from one /auth/login with the cookie of another → 401',
    mismatched.status === 401 && !setsSession(mismatched),
    `status=${mismatched.status}`,
  );

  // An open-redirect attempt must land inside the subsystem.
  const evil = await beginLogin('//evil.example.com');
  const evilAuthorize = await handoff(evil.state ?? undefined);
  const evilCallback = evilAuthorize.location ? await callback(evilAuthorize.location, evil.cookie) : { status: 0 };
  const landing = evilCallback.location ? new URL(evilCallback.location, baseUrl) : null;
  report.expectTrue(
    'L3-21',
    'next=//evil.example.com still lands on a path of the subsystem itself',
    evilCallback.status === 302 && landing !== null && landing.origin === new URL(baseUrl).origin,
    `status=${evilCallback.status} location=${shown(evilCallback.location) || '(none)'}`,
  );

  report.group('L3 · SSO — sign-out');

  const logout = await call(`${baseUrl}${sso.subsystemLogoutPath}`, {
    method: 'POST',
    cookie: session ? cookiePair(session) : undefined,
  });
  const logoutSession = cookieByName(logout, names.session);
  report.expectTrue(
    'L3-22',
    `POST ${sso.subsystemLogoutPath} → 303 to Core Hub web /logout and clears ${names.session}`,
    logout.status === 303 &&
      Boolean(coreHubWebUrl) &&
      logout.location === `${coreHubWebUrl}${sso.coreHubWebLogoutPath}` &&
      Boolean(logoutSession) &&
      /max-age=0(\s*;|\s*$)/i.test(logoutSession),
    `status=${logout.status} location=${shown(logout.location) || '(none)'} ` +
      `set-cookie=${shownCookie(logoutSession) ?? '(none)'}`,
  );
}

// ----------------------------------------------------------------- main ---

async function main() {
  const args = parseArgs(process.argv);
  const config = loadConfig(args);

  console.log('CSMJU2030 Subsystem Conformance Runner');
  console.log(`standard      : v${JWT_CONTRACT.standardsVersion}`);
  console.log(`subsystem     : ${config.subsystemId}`);
  console.log(`base url      : ${config.baseUrl}`);
  console.log(`core hub      : ${config.coreHubUrl}`);
  console.log(`level         : ${config.level}`);

  // Before any request: without a usable account source the run stops here.
  const source = resolveAccounts({
    coreHubUrl: config.coreHubUrl,
    repoRoots: repoRootsFor({
      manifestPath: config.manifestPath,
      runnerDir: path.resolve(__dirname, '..'),
    }),
  });

  console.log(
    `accounts      : ${
      source.source === 'file'
        ? `${source.file} (${ACCOUNTS_ENV})`
        : 'บัญชี seed ของ Core Hub ในเครื่อง (admin|student|staff|alumni@core.local)'
    }`,
  );
  for (const warning of source.warnings) console.log(`              ⚠ ${warning}`);

  const report = new Report();

  const { tokens, ownerToken, failures } = await loginAll(config.coreHubUrl, source.accounts);
  const obtained = Object.keys(tokens);
  config.loginFailures = Object.fromEntries(failures.map(({ key, problem }) => [key, problem]));

  console.log(`tokens        : ${obtained.join(', ') || '(none)'}${ownerToken ? ' · owner' : ''}`);
  for (const { key, problem } of failures) console.log(`login failed  : ${key} — ${problem}`);
  if (failures.some(({ problem }) => /^(401|429)/.test(problem))) {
    console.log(
      '              → ไม่ลองซ้ำ: Core Hub ล็อกอีเมลหลัง login ผิด 10 ครั้งใน 15 นาที ' +
        '(บัญชีทดสอบใช้ร่วมกันทุกทีม) — แก้ไฟล์บัญชีก่อนรันใหม่',
    );
  }

  if (obtained.length === 0) {
    console.error(
      `\nERROR: could not obtain any Core Hub token for a role from ${config.coreHubUrl}. ` +
        (source.source === 'file'
          ? `ตรวจบัญชีใน ${ACCOUNTS_ENV} (ดู login failed ด้านบน)`
          : 'Is the Core Hub running and seeded?'),
    );
    process.exit(2);
  }

  await runLevel1(config, report, tokens);

  if (config.level === 'L2' || config.level === 'L3') {
    await runLevel2(config, report, tokens);
  }

  if (config.level === 'L3') {
    await runLevel3(config, report, tokens, ownerToken);
  }

  // Worth knowing, never a failure: retries after a 429 and codes outside the enum.
  if (observations.retries.length > 0 || observations.unknownCodes.size > 0) {
    report.group('Warnings');
  }
  if (observations.retries.length > 0) {
    report.warn(
      'W-RETRY',
      `${observations.retries.length} request(s) were throttled (429) and retried once`,
      observations.retries.map((retry) => `${retry.url} after ${retry.wait}s`).join(' · '),
    );
  }
  for (const [code, where] of observations.unknownCodes) {
    report.warn(
      'W-CODE',
      `error.code "${code}" is not in contracts/error-codes.json (FAIL from the next version)`,
      [...where].join(' · '),
    );
  }

  const { PASS, FAIL, SKIP, WARN } = report.counts;
  const retries = observations.retries.length;
  // A skipped check was not tested, so it cannot count as met.
  const conformant = FAIL === 0 && SKIP === 0;

  console.log(`\n${'─'.repeat(60)}`);
  console.log(
    `RESULT: ${PASS} passed · ${FAIL} failed · ${SKIP} skipped · ${WARN} warnings · retries: ${retries}`,
  );

  if (conformant) {
    console.log(
      `✅ CONFORMANT — ${config.subsystemId} meets standard v${JWT_CONTRACT.standardsVersion} ${config.level}`,
    );
  } else {
    const reasons = [];
    if (FAIL > 0) reasons.push(`${FAIL} required check(s) failed`);
    if (SKIP > 0) reasons.push(`${SKIP} check(s) skipped (SKIP ไม่นับว่าผ่าน)`);
    console.log(`❌ NOT CONFORMANT — ${reasons.join(' · ')}`);

    for (const result of report.results.filter((item) => item.status === 'SKIP')) {
      console.log(`   SKIP ${result.id.padEnd(10)} ${result.title}\n              → ${result.detail}`);
    }
  }

  if (config.json) {
    fs.writeFileSync(
      'conformance-report.json',
      JSON.stringify(
        {
          subsystemId: config.subsystemId,
          standardsVersion: JWT_CONTRACT.standardsVersion,
          level: config.level,
          summary: { ...report.counts, retries },
          conformant,
          results: report.results,
          generatedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    console.log('report        : conformance-report.json');
  }

  process.exit(conformant ? 0 : 1);
}

main().catch((error) => {
  console.error(`\nERROR: ${error.message}`);
  process.exit(2);
});
