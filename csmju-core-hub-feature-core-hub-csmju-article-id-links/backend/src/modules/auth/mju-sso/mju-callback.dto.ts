import { IsString, Matches } from 'class-validator';

/** Body of POST /auth/mju/callback — the `ac` query parameter MJU SSO sent. */
export class MjuCallbackDto {
  @IsString()
  @Matches(/^[A-Za-z0-9]{32}$/, {
    message: 'code must be a 32-character alphanumeric authorization code',
  })
  code!: string;
}
