export function notFound(message: string) {
  return { success: false, error: { code: 'NOT_FOUND', message } };
}
