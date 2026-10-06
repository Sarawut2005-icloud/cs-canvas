'use strict';
/** Tiny zero-dependency test harness: HTTP helpers + result reporting. */

const ERROR_CODES = require('../../contracts/error-codes.json').codes;

/** A 429 asking to wait at most this long is waited out and retried once. */
const MAX_RETRY_AFTER_SEC = 5;

/**
 * What happened on the wire that is not a check of its own: retries after a
 * 429, and error codes outside contracts/error-codes.json. Both are reported
 * as WARN at the end - a warning never fails the run.
 */
const observations = {
  retries: [],
  unknownCodes: new Map(),
};

class Report {
  constructor() {
    this.results = [];
    this.currentGroup = 'general';
  }

  group(name) {
    this.currentGroup = name;
    console.log(`\n── ${name}`);
  }

  record(status, id, title, detail = '') {
    this.results.push({ group: this.currentGroup, id, title, status, detail });

    const mark = { PASS: '  PASS', FAIL: '  FAIL', SKIP: '  SKIP', WARN: '  WARN' }[status];
    const line = `${mark}  ${id.padEnd(10)} ${title}`;

    console.log(detail && status !== 'PASS' ? `${line}\n            → ${detail}` : line);
  }

  pass(id, title, detail) {
    this.record('PASS', id, title, detail);
  }

  fail(id, title, detail) {
    this.record('FAIL', id, title, detail);
  }

  skip(id, title, detail) {
    this.record('SKIP', id, title, detail);
  }

  /** Worth knowing, not a failure: it never changes the exit code. */
  warn(id, title, detail) {
    this.record('WARN', id, title, detail);
  }

  /** Asserts `actual === expected`. */
  expect(id, title, actual, expected) {
    if (actual === expected) {
      this.pass(id, title);
      return true;
    }

    this.fail(id, title, `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    return false;
  }

  expectTrue(id, title, condition, detail) {
    return condition ? this.pass(id, title) || true : this.fail(id, title, detail) || false;
  }

  get counts() {
    const counts = { PASS: 0, FAIL: 0, SKIP: 0, WARN: 0 };
    for (const result of this.results) counts[result.status] += 1;
    return counts;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Path of a URL without its query, which can carry an access token. */
function redact(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return String(url).split('?')[0];
  }
}

async function send(url, options) {
  const { token, cookie, json, method = 'GET', redirect = 'manual', headers = {} } = options;

  const requestHeaders = { accept: 'application/json', ...headers };

  if (token) requestHeaders.authorization = `Bearer ${token}`;
  if (cookie) requestHeaders.cookie = cookie;
  if (json !== undefined) requestHeaders['content-type'] = 'application/json';

  return fetch(url, {
    method,
    redirect,
    headers: requestHeaders,
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
  });
}

/**
 * GET/POST helper that never throws on HTTP status.
 *
 * `setCookies` lists every Set-Cookie header. A callback on standards 1.1 sets
 * two - the state removal and the session - so reading only the first header
 * would find the removal and miss the session.
 */
async function call(url, options = {}) {
  let response;

  try {
    response = await send(url, options);

    // A rate limiter asking for a short pause is honoured once, and counted:
    // the summary shows how often it happened, since a conformance run with
    // the shipped limits should not need it at all.
    if (response.status === 429 && !options.noRetry) {
      const wait = Number(response.headers.get('retry-after'));
      if (Number.isFinite(wait) && wait >= 0 && wait <= MAX_RETRY_AFTER_SEC) {
        observations.retries.push({ url: redact(url), wait });
        await sleep(wait * 1000 + 100);
        response = await send(url, options);
      }
    }
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: null,
      error: error.message,
      headers: new Headers(),
      setCookie: null,
      setCookies: [],
    };
  }

  const text = await response.text();
  let body = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (isErrorEnvelope(body) && !isKnownErrorCode(body.error.code)) {
    const seen = observations.unknownCodes.get(body.error.code) ?? new Set();
    seen.add(`${options.method ?? 'GET'} ${redact(url)} → ${response.status}`);
    observations.unknownCodes.set(body.error.code, seen);
  }

  const setCookies = response.headers.getSetCookie();

  return {
    ok: response.ok,
    status: response.status,
    headers: response.headers,
    location: response.headers.get('location'),
    setCookie: setCookies[0] ?? null,
    setCookies,
    body,
    text,
  };
}

/** The whole Set-Cookie header for cookie `name`, or null. */
function cookieByName(result, name) {
  return (result.setCookies ?? []).find((entry) => entry.startsWith(`${name}=`)) ?? null;
}

/** `name=value` from a Set-Cookie header, ready for a Cookie request header. */
function cookiePair(setCookie) {
  return setCookie ? setCookie.split(';')[0] : '';
}

/**
 * A Set-Cookie header safe to print: the value is replaced, the attributes
 * stay. A session cookie holds a Core Hub token, which never goes to a log.
 */
function shownCookie(setCookie) {
  if (!setCookie) return setCookie;
  const [pair, ...attributes] = setCookie.split(';');
  const name = pair.split('=')[0];
  const value = pair.split('=').slice(1).join('=');
  return [`${name}=${value === '' ? '' : '<value>'}`, ...attributes].join(';');
}

/** True when a Set-Cookie header deletes its cookie rather than setting one. */
function deletesCookie(setCookie) {
  if (!setCookie) return false;
  const value = cookiePair(setCookie).split('=').slice(1).join('=');
  return /;\s*max-age=0(\s*;|\s*$)/i.test(setCookie) || value === '';
}

/** Standard success envelope: { success: true, data, meta? } */
function isSuccessEnvelope(body) {
  return (
    body !== null &&
    typeof body === 'object' &&
    body.success === true &&
    Object.prototype.hasOwnProperty.call(body, 'data')
  );
}

/** Standard error envelope: { success: false, error: { code, message } } */
function isErrorEnvelope(body) {
  return (
    body !== null &&
    typeof body === 'object' &&
    body.success === false &&
    body.error !== null &&
    typeof body.error === 'object' &&
    typeof body.error.code === 'string' &&
    typeof body.error.message === 'string'
  );
}

function isKnownErrorCode(code) {
  return ERROR_CODES.includes(code);
}

/** Rejects any response that leaks internals (stack traces, SQL, file paths). */
function leaksInternals(text) {
  if (typeof text !== 'string') return false;

  return /"stack"|\bat .+\(.+:\d+:\d+\)|node_modules|SELECT .+ FROM |PrismaClient/i.test(text);
}

module.exports = {
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
  redact,
  ERROR_CODES,
};
