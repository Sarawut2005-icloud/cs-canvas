import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SsoAuthorizeDto {
  /** Registered subsystem id or name (for example: student-service). */
  @IsString()
  @MinLength(1)
  subsystem!: string;

  /**
   * Optional callback URL. When supplied it MUST match the callback URL
   * registered for the subsystem, otherwise the request is rejected.
   * When omitted the registered callback URL is used.
   */
  @IsOptional()
  @IsUrl({
    require_protocol: true,
    // Development callbacks such as http://localhost:3001/auth/callback have no
    // TLD; the registry match below is what actually authorises the URL.
    require_tld: false,
  })
  callback_url?: string;

  /** Opaque value echoed back to the subsystem callback. */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  state?: string;
}
