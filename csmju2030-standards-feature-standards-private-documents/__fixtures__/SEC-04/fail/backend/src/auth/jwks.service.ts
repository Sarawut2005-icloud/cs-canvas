// ผิดสัญญา: ใช้ jsonwebtoken + HS256 + secret แทน JWKS/RS256
import * as jwt from 'jsonwebtoken';

export function verify(token: string) {
  return jwt.verify(token, process.env.JWT_SECRET as string, { algorithms: ['HS256'] });
}
