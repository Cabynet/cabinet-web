// Requires the web dev server: node test/folder-collaboration.browser.mjs
// All API responses are mocked; no accounts or memberships are changed.
import assert from "node:assert/strict"
import { chromium, expect } from "@playwright/test"

const origin = process.env.WEB_URL || "http://localhost:3000"
const token = "a".repeat(64)
const folderId = "11111111-1111-4111-8111-111111111111"
const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (error) => errors.push(error.message))
  let signedIn = false
  let joinStatus = 404
  let inviteEnabled = false
  let inviteRole = "CONTRIBUTOR"
  let shareToken = null
  let shareExpiresAt = null
  let shareRole = "VIEWER"
  let inviteExpiresAt = null
  const inDays = (days) => days == null ? null : new Date(Date.now() + days * 86400000).toISOString()
  let members = []
  const sharedId = "33333333-3333-4333-8333-333333333333"
  const lockedId = "44444444-4444-4444-8444-444444444444"
  let sharedJoined = true
  let lockedRequested = false
  let requests = [{ userId: "55555555-5555-4555-8555-555555555555", name: "Requester", email: "req@example.com", message: "For the project", createdAt: "2026-11-24T00:00:00Z" }]
  const writes = []
  await page.route("**/v1/**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const method = request.method()
    const body = request.postData() ? JSON.parse(request.postData()) : undefined
    // The Rust API returns plain JSON (no { data } envelope) and { error: { code, message } } for failures.
    const response = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true" }, body: JSON.stringify(body?.data !== undefined && Object.keys(body).length === 1 ? body.data : body) })
    if (method === "OPTIONS") return response({})
    if (method !== "GET") writes.push({ method, path, body })
    if (path.endsWith("/auth/me")) return signedIn ? response({ id: "owner", name: "Test owner", email: "owner@example.com", avatarUrl: null, session: { id: "test", expiresAt: "2099-01-01T00:00:00Z" } }) : response({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, 401)
    if (path.endsWith(`/invitations/${token}/accept`)) return response({ data: { folderId } }, joinStatus)
    if (path.endsWith("/collaboration")) return response({ data: { owner: { id: "owner", name: "Test owner", email: "owner@example.com" }, inviteEnabled, inviteRole, inviteExpiresAt, inviteToken: inviteEnabled ? token : null, members } })
    if (path.endsWith("/invitation")) {
      if (method === "PUT") { inviteEnabled = true; inviteRole = body?.role ?? inviteRole; inviteExpiresAt = null }
      if (method === "PATCH") { inviteRole = body.role ?? inviteRole; if ("expiresInDays" in body) inviteExpiresAt = inDays(body.expiresInDays) }
      if (method === "DELETE") { inviteEnabled = false; inviteExpiresAt = null }
      return response({ data: { token, inviteEnabled, inviteRole } })
    }
    if (path.endsWith(`/folders/${folderId}/members`) && method === "POST") {
      if (body.email === "nobody@example.com") return response({ error: { code: "NOT_FOUND", message: "No Cabinet account uses this email. Send them the invite link instead." } }, 404)
      members = [...members, { userId: "22222222-2222-4222-8222-222222222222", role: body.role, user: { name: "Friend", email: body.email } }]
      return response({ data: members.at(-1) })
    }
    if (path.includes(`/folders/${folderId}/members/`)) {
      if (method === "PATCH") members = members.map((member) => ({ ...member, role: body.role }))
      if (method === "DELETE") { members = []; inviteEnabled = false }
      return response({ data: {} })
    }
    if (path.endsWith("/share")) {
      if (method === "PUT" || method === "POST") { shareToken = "b".repeat(64); shareExpiresAt = null; shareRole = body?.role ?? "VIEWER" }
      if (method === "PATCH") { shareRole = body.role ?? shareRole; if ("expiresInDays" in body) shareExpiresAt = inDays(body.expiresInDays) }
      if (method === "DELETE") { shareToken = null; shareExpiresAt = null; shareRole = "VIEWER" }
      return response({ data: { shareToken, expiresAt: shareExpiresAt, role: shareRole } })
    }
    if (path.endsWith(`/folders/${lockedId}/access-requests/mine`)) return response({ requested: lockedRequested })
    if (path.endsWith(`/folders/${lockedId}/access-requests`)) { lockedRequested = true; return response({ requested: true }) }
    if (path.endsWith(`/folders/${folderId}/access-requests`)) return response(requests)
    if (path.includes(`/folders/${folderId}/access-requests/`)) {
      const userId = path.split("/access-requests/")[1].replace("/approve", "")
      const request = requests.find((r) => r.userId === userId)
      requests = requests.filter((r) => r.userId !== userId)
      if (path.endsWith("/approve")) members = [...members, { userId, role: body.role, user: { name: request.name, email: request.email } }]
      return response({ updated: true })
    }
    if (path.endsWith(`/folders/${sharedId}/membership`)) { sharedJoined = false; return response({ removed: true }) }
    if (path.endsWith("/folders")) return response({ data: [
      { id: folderId, userId: "owner", isOwner: true, access: "OWNER", name: "Team links", parentId: null, pendingRequests: requests.length },
      ...(sharedJoined ? [{ id: sharedId, userId: "friend", isOwner: false, access: "EDITOR", name: "Friend's reading", parentId: null, pendingRequests: 0 }] : []),
    ] })
    if (path.endsWith("/bookmarks")) return response({ items: [], totalCount: 0, nextCursor: null, hasMore: false })
    if (path.endsWith("/health")) return response({ data: { total: 0, broken: 0, redirected: 0, favorites: 0, archived: 0, trash: 0, duplicates: 0 } })
    return response({ data: [] })
  })
  await page.goto(`${origin}/invite/${token}`)
  await expect(page.getByRole("link", { name: "Sign in to join" })).toHaveAttribute("href", `/login?next=${encodeURIComponent(`/invite/${token}`)}`)
  await page.goto(`${origin}/invite/invalid`)
  await expect(page.locator("main").getByRole("alert")).toHaveText("Invalid invitation link.")

  signedIn = true
  await context.addCookies([{ name: "cabinet_session", value: "browser-test", url: origin }])
  await page.goto(`${origin}/invite/${token}`)
  await page.getByRole("button", { name: "Join folder", exact: true }).click()
  await expect(page.locator("main").getByRole("alert")).toContainText("no longer active")
  joinStatus = 200
  await page.getByRole("button", { name: "Join folder", exact: true }).click()
  await page.waitForURL(`${origin}/cabinet/folders/${folderId}`)

  // Folders shared with you sit under "Shared with me" and can be left.
  const sidebar = page.getByRole("navigation", { name: "Library navigation" })
  await expect(sidebar.getByText("Shared with me", { exact: true })).toBeVisible()
  await expect(sidebar.getByText("Friend's reading", { exact: true })).toBeVisible()
  await expect(sidebar.getByTitle("1 access request", { exact: true })).toBeVisible() // pending on Team links

  // One Share dialog, like Google Drive: requests, people, roles, general access.
  await page.getByRole("button", { name: /^Share/ }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toContainText("Share “Team links”")
  await expect(dialog).toContainText("Owner")

  // Access requests: the owner approves with a role (or declines).
  await expect(dialog.getByText("Access requests", { exact: true })).toBeVisible()
  await expect(dialog).toContainText("“For the project”")
  await dialog.getByRole("combobox", { name: "Role for Requester" }).click()
  await page.getByRole("option", { name: "Contributor" }).click()
  await dialog.getByRole("button", { name: "Approve", exact: true }).click()
  assert.deepEqual(writes.at(-1), { method: "POST", path: `/v1/folders/${folderId}/access-requests/55555555-5555-4555-8555-555555555555/approve`, body: { role: "CONTRIBUTOR" } })
  await expect(dialog.getByText("Access requests", { exact: true })).toHaveCount(0)
  await expect(dialog.getByRole("combobox", { name: "Access for Requester" })).toHaveText("Contributor")

  await dialog.getByLabel("Email address").fill("nobody@example.com")
  await dialog.getByRole("button", { name: "Share", exact: true }).click()
  await expect(dialog.getByRole("alert")).toContainText("No Cabinet account uses this email")

  await dialog.getByLabel("Email address").fill("friend@example.com")
  await dialog.getByRole("combobox", { name: "Role for the new person" }).click()
  await page.getByRole("option", { name: "Editor" }).click()
  await dialog.getByRole("button", { name: "Share", exact: true }).click()
  const friendRole = dialog.getByRole("combobox", { name: "Access for Friend" })
  await expect(friendRole).toHaveText("Editor")
  assert.deepEqual(writes.at(-1).body, { email: "friend@example.com", role: "EDITOR" })

  await friendRole.click()
  await page.getByRole("option", { name: "Viewer" }).click()
  await expect(friendRole).toHaveText("Viewer")
  assert.deepEqual(writes.at(-1).body, { role: "VIEWER" })

  // General access, like Google Drive: one link, Restricted or Anyone with the link plus a role.
  const generalAccess = dialog.getByRole("combobox", { name: "General access" })
  const copyLink = dialog.getByRole("button", { name: "Copy link", exact: true })
  const clipboard = () => page.evaluate(() => navigator.clipboard.readText())
  await expect(generalAccess).toHaveText("Restricted")
  await expect(dialog).toContainText("Only people with access can open with the link")
  await expect(dialog.getByRole("combobox", { name: "Role for anyone with the link" })).toHaveCount(0)
  // Restricted still has a link: the folder itself, for people with access.
  await copyLink.click()
  await expect.poll(clipboard).toBe(`${origin}/cabinet/folders/${folderId}`)

  await generalAccess.click()
  await page.getByRole("option", { name: "Anyone with the link" }).click()
  assert.deepEqual(writes.at(-1), { method: "POST", path: `/v1/folders/${folderId}/share`, body: { role: "VIEWER" } })
  await expect(generalAccess).toHaveText("Anyone with the link")
  await expect(dialog).toContainText("Anyone with the link can view, no sign-in needed")
  await copyLink.click()
  await expect.poll(clipboard).toBe(`${origin}/share/${"b".repeat(64)}`)

  // The link's role changes what it allows, without changing the link.
  const linkRole = dialog.getByRole("combobox", { name: "Role for anyone with the link" })
  await expect(linkRole).toHaveText("Viewer")
  await linkRole.click()
  await page.getByRole("option", { name: "Editor" }).click()
  assert.deepEqual(writes.at(-1), { method: "PATCH", path: `/v1/folders/${folderId}/share`, body: { role: "EDITOR" } })
  await expect(linkRole).toHaveText("Editor")
  await expect(dialog).toContainText("people who sign in can add and edit")
  await copyLink.click()
  await expect.poll(clipboard).toBe(`${origin}/share/${"b".repeat(64)}`)

  // A link never expires until the owner picks a duration; picking one keeps the role.
  const linkExpiry = dialog.getByRole("combobox", { name: "When the link expires" })
  await expect(linkExpiry).toHaveText("Never expires")
  await linkExpiry.click()
  await page.getByRole("option", { name: "In 30 days" }).click()
  assert.deepEqual(writes.at(-1), { method: "PATCH", path: `/v1/folders/${folderId}/share`, body: { expiresInDays: 30 } })
  await expect(linkExpiry).toHaveText(/^Expires in (30|29) days$/)
  await expect(linkRole).toHaveText("Editor")
  await linkExpiry.click()
  await page.getByRole("option", { name: "Never" }).click()
  assert.deepEqual(writes.at(-1).body, { expiresInDays: null })
  await expect(linkExpiry).toHaveText("Never expires")

  // The setting survives closing and reopening the dialog.
  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()
  await page.getByRole("button", { name: /^Share/ }).first().click()
  await expect(generalAccess).toHaveText("Anyone with the link")
  await expect(linkRole).toHaveText("Editor")

  // A separate invite link from before General access can be turned off.
  inviteEnabled = true
  await friendRole.click()
  await page.getByRole("option", { name: "Contributor" }).click()
  await expect(dialog).toContainText("Older invite link")
  await dialog.getByRole("button", { name: "Turn off", exact: true }).click()
  assert.deepEqual(writes.at(-1), { method: "DELETE", path: `/v1/folders/${folderId}/invitation`, body: undefined })
  await expect(dialog).not.toContainText("Older invite link")

  await friendRole.click()
  await page.getByRole("option", { name: "Remove access" }).click()
  await expect(dialog.getByRole("combobox", { name: "Access for Friend" })).toHaveCount(0)
  // An editor link still lets them back in, so the owner is told how to stop that.
  await expect(page.getByText(/Anyone with the link can still join/)).toBeVisible()
  await generalAccess.click()
  await page.getByRole("option", { name: "Restricted" }).click()
  assert.deepEqual(writes.at(-1), { method: "DELETE", path: `/v1/folders/${folderId}/share`, body: undefined })
  await expect(dialog.getByRole("combobox", { name: "Role for anyone with the link" })).toHaveCount(0)
  await page.keyboard.press("Escape")

  // Leaving a shared folder asks first, then removes it from the sidebar.
  await sidebar.getByRole("button", { name: "Actions for Friend's reading" }).click()
  await page.getByRole("menuitem", { name: "Leave folder" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Leave", exact: true }).click()
  assert.deepEqual(writes.at(-1), { method: "DELETE", path: `/v1/folders/${sharedId}/membership`, body: undefined })
  await expect(sidebar.getByText("Friend's reading", { exact: true })).toHaveCount(0)
  await expect(sidebar.getByText("Shared with me", { exact: true })).toHaveCount(0)

  // A folder link without access offers "Request access", like Google Drive.
  await page.goto(`${origin}/cabinet/folders/${lockedId}`)
  await expect(page.getByText("You need access", { exact: true })).toBeVisible()
  await page.getByLabel("Message for the owner (optional)").fill("Please add me")
  await page.getByRole("button", { name: "Request access", exact: true }).click()
  assert.deepEqual(writes.at(-1), { method: "POST", path: `/v1/folders/${lockedId}/access-requests`, body: { message: "Please add me" } })
  await expect(page.getByText(/Request sent\. Once the owner approves/)).toBeVisible()
  await expect(page.getByRole("button", { name: "Send again", exact: true })).toBeVisible()

  assert.deepEqual(errors, [])
  console.log("PASS invitation sign-in, invalid/revoked handling, acceptance redirect, sharing by email with roles, role changes, general access with link roles, copy link, link expiry, older invite links, removal, access requests, shared with me, leaving, and request access")
} finally { await browser.close() }
