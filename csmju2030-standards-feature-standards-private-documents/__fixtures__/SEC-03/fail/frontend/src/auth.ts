export function saveSession(token: string) {
  localStorage.setItem('access_token', token);
}
