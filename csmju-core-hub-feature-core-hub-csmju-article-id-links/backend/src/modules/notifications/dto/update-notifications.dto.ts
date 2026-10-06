import { Equals } from 'class-validator';

/** `PATCH /notifications` — marks every notification of the caller read. */
export class UpdateNotificationsDto {
  @Equals(true)
  read: true;
}
