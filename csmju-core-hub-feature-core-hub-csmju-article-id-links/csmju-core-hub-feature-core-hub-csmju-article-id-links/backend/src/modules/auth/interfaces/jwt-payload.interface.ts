export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  sid: string;

  iss: string;
  aud: string;

  /**
   * Handoff tokens only: the registry name of the subsystem the token was
   * issued to. Absent on Core Hub's own web access token.
   */
  azp?: string;

  iat?: number;
  exp?: number;
}
