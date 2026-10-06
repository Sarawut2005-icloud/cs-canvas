'use strict';
/**
 * Token helpers for the conformance suite.
 *
 * Every negative token is signed with a throwaway key pair generated inside
 * this process - the Core Hub private key is never needed, never read and
 * never distributed. A conformant subsystem must answer 401 to all of them.
 */
const crypto = require('node:crypto');

const b64url = (input) =>
  Buffer.from(typeof input === 'string' ? input : JSON.stringify(input))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const { privateKey: FOREIGN_KEY } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
});

function signRs256(header, payload, key = FOREIGN_KEY) {
  const signingInput = `${b64url(header)}.${b64url(payload)}`;
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(signingInput)
    .end()
    .sign(key)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${signingInput}.${signature}`;
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function basePayload(contract, overrides = {}) {
  const iat = nowSec();

  return {
    sub: 'user-002',
    email: 'student@core.local',
    role: 'student',
    sid: 'conformance-session',
    iss: contract.issuer,
    aud: contract.audience,
    iat,
    exp: iat + 900,
    ...overrides,
  };
}

/**
 * Builds every token a conformant subsystem must reject.
 * `validToken` is a real Core Hub token, used for the tampering cases.
 */
function negativeTokens(contract, validToken) {
  const header = { alg: 'RS256', typ: 'JWT', kid: contract.kid };

  const tokens = {
    malformed: 'not-a-jwt',
    empty: '',
    expired: signRs256(header, basePayload(contract, { iat: nowSec() - 3600, exp: nowSec() - 60 })),
    wrongIssuer: signRs256(header, basePayload(contract, { iss: 'evil-hub' })),
    wrongAudience: signRs256(header, basePayload(contract, { aud: 'another-platform' })),
    unknownKid: signRs256({ ...header, kid: 'unknown-key-9999' }, basePayload(contract)),
    foreignSignature: signRs256(header, basePayload(contract)),
    missingSubject: signRs256(header, (() => {
      const payload = basePayload(contract);
      delete payload.sub;
      return payload;
    })()),
    algNone: `${b64url({ alg: 'none', typ: 'JWT', kid: contract.kid })}.${b64url(
      basePayload(contract, { role: 'admin' }),
    )}.`,
    hs256: (() => {
      const signingInput = `${b64url({ alg: 'HS256', typ: 'JWT', kid: contract.kid })}.${b64url(
        basePayload(contract, { role: 'admin' }),
      )}`;
      const signature = crypto
        .createHmac('sha256', 'attacker-secret')
        .update(signingInput)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      return `${signingInput}.${signature}`;
    })(),
  };

  if (validToken) {
    const [head, payload, signature] = validToken.split('.');
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));

    // Real signature, escalated payload - the classic tampering attack.
    // The new value must differ from the original, otherwise the re-encoded
    // payload can come out byte-identical and the token stays valid.
    const escalatedRole = decoded.role === 'admin' ? 'staff' : 'admin';

    tokens.tamperedRole = `${head}.${b64url({ ...decoded, role: escalatedRole })}.${signature}`;
    tokens.tamperedSubject = `${head}.${b64url({
      ...decoded,
      sub: `${decoded.sub}-tampered`,
    })}.${signature}`;
  }

  return tokens;
}

function decodeJwt(token) {
  const [header, payload] = token.split('.');

  return {
    header: JSON.parse(Buffer.from(header, 'base64url').toString('utf8')),
    payload: JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')),
  };
}

module.exports = { negativeTokens, decodeJwt, b64url, signRs256 };
