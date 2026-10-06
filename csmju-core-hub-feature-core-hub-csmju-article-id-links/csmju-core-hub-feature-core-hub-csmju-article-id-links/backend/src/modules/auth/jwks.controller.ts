import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicKey } from 'crypto';
import { readFileSync } from 'fs';

import { SkipRateLimit } from '../../common/rate-limit/rate-limit.decorator';

// Every subsystem fetches the signing keys from here. If this were throttled,
// tokens would stop verifying across the whole platform at once.
@SkipRateLimit()
@Controller('.well-known')
export class JwksController {
  constructor(private readonly configService: ConfigService) {}

  @Get('jwks.json')
  getJwks() {
    const publicKeyPath =
      this.configService.get<string>('jwt.publicKeyPath') ??
      'keys/jwt-public.pem';

    const publicKeyPem = readFileSync(publicKeyPath, 'utf8');

    const publicKey = createPublicKey(publicKeyPem);

    const jwk = publicKey.export({
      format: 'jwk',
    });

    return {
      keys: [
        {
          ...jwk,
          kid: 'core-hub-2026',
          use: 'sig',
          alg: 'RS256',
        },
      ],
    };
  }
}
