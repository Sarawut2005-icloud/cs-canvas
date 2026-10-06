export function saveSession(token: string) {
  document.cookie = `session=${token}; HttpOnly; Secure`;
}
