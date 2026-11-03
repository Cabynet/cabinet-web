/** The message from the API's { error: { message } } envelope, or the fallback. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { error?: { message?: unknown } } } })?.response?.data?.error?.message
  return typeof message === "string" ? message : error instanceof Error && error.message ? error.message : fallback
}
