// Only allow known sharing and /cabinet return paths; never redirect to a supplied origin.
export function loginReturnPath(search: string) {
  const next = new URLSearchParams(search).get("next")
  const allowed = next && (/^\/(?:share|invite)\/[a-f0-9]{64}$/.test(next) || /^\/cabinet(?:[/?][\w\-./%?&=~]*)?$/.test(next))
  return allowed ? next : "/cabinet"
}
