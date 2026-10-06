import { PartialType } from '@nestjs/mapped-types';
import { CreateSubsystemDto } from './create-subsystem.dto';

export class UpdateSubsystemDto extends PartialType(CreateSubsystemDto) {}
