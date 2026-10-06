// ตรวจ JWT ตามสัญญา: ดึง public key จาก JWKS ของ Core Hub แล้วเลือกด้วย kid
import { importJWK, jwtVerify, decodeProtectedHeader } from 'jose';

export async function verify(token: string, jwksUrl: string) {
  const header = decodeProtectedHeader(token);
  if (header.alg !== 'RS256') throw new Error('unsupported algorithm');

  const jwks = await (await fetch(jwksUrl)).json();
  const jwk = jwks.keys.find((k: { kid?: string }) => k.kid === header.kid);
  const key = await importJWK(jwk, 'RS256');

  return jwtVerify(token, key, {
    algorithms: ['RS256'],
    issuer: process.env.CORE_HUB_ISSUER,
    audience: process.env.CORE_HUB_AUDIENCE,
  });
}
