// Only allow known sharing and /cabinet return paths; never redirect to a supplied origin.
export function loginReturnPath(search: string) {
  const next = new URLSearchParams(search).get("next")
  // A share page may ask to finish saving (?save=1) or joining (?join=1) after sign-in.
  const allowed = next && (/^\/(?:share|invite)\/[a-f0-9]{64}$/.test(next) || /^\/share\/[a-f0-9]{64}\?(?:save|join)=1$/.test(next) || /^\/cabinet(?:[/?][\w\-./%?&=~]*)?$/.test(next))
  return allowed ? next : "/cabinet"
}
