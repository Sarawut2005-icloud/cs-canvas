export type SessionStatus = 'active' | 'revoked';

export interface Session {
  id: string;
  userId: string;
  status: SessionStatus;

  refreshTokenHash: string;

  createdAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
}
