import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Body of `reject` and `suspend` — the reason is shown to the owner. */
export class RequiredReasonDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

/** Body of `deactivate` — a reason is welcome but not required. */
export class OptionalReasonDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
