// Mocked auth API; exercises account deletion and re-authentication without an account.
// Run: node test/account-settings.browser.mjs [screenshot-dir]
import { chromium, expect } from '@playwright/test'
import { cabinetResponse } from './fixtures/cabinet-data.mjs'

const origin = process.env.WEB_URL || 'http://localhost:3000'
const shots = process.argv[2]
const email = 'raka@cabinet.test'
const hoursAgo = (hours) => new Date(Date.now() - hours * 3_600_000).toISOString()

async function open(browser, state) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await context.addCookies([{ name: 'cabinet_session', value: 'browser-test', url: origin }])
  await context.route('**/v1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() !== 'GET') state.writes.push(`${path.replace('/v1/auth', '')} ${request.postData() ?? ''}`.trim())
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true' }, body: JSON.stringify(body) })
    if (path.endsWith('/auth/me')) return state.deleted ? json({ error: { message: 'Signed out' } }, 401) : json({ id: 'owner', name: 'Raka Pradana', email, session: { id: 'test', userId: 'owner', createdAt: state.signedInAt, expiresAt: '2099-01-01T00:00:00Z' } })
    if (path.endsWith('/auth/sign-in/social')) {
      state.signedInAt = hoursAgo(0)
      return json({ url: JSON.parse(request.postData()).callbackURL, redirect: true })
    }
    if (path.endsWith('/users/me') && request.method() === 'DELETE') {
      if (state.requirePassword && JSON.parse(request.postData() || '{}').currentPassword !== 'correct-horse') return json({ error: { code: 'UNAUTHORIZED', message: 'Current password incorrect' } }, 401)
      if (state.serverSaysStale) return json({ error: { code: 'SESSION_NOT_FRESH', message: 'Session expired. Re-authenticate to perform this action.' } }, 403)
      state.deleted = true
      return json({ success: true, message: 'User deleted' })
    }
    return json(cabinetResponse(request.url()))
  })
  const page = await context.newPage()
  await page.goto(`${origin}/cabinet/settings?tab=account`)
  return { context, page }
}

const browser = await chromium.launch({ headless: true })
try {
  const state = { signedInAt: hoursAgo(1), writes: [], requirePassword: true }
  let { context, page } = await open(browser, state)
  await expect(page.getByRole('region', { name: /^Notifications/ })).toHaveCount(1)
  await expect(page.getByText('Sign-in methods')).toHaveCount(0)

  // Deleting needs the email typed out, then signs out to the login page.
  await page.getByRole('button', { name: 'Delete account' }).click()
  const dialog = page.getByRole('dialog', { name: 'Delete your Cabinet account?' })
  const confirmDelete = dialog.getByRole('button', { name: 'Delete account' })
  await expect(confirmDelete).toBeDisabled()
  await dialog.getByLabel('Type your email to confirm').fill('someone@else.test')
  await expect(confirmDelete).toBeDisabled()
  await dialog.getByLabel('Type your email to confirm').fill(` ${email.toUpperCase()} `)
  if (shots) await page.screenshot({ path: `${shots}/account-delete.png` })
  // A password account must re-enter its password; the server's message is shown in the dialog.
  await confirmDelete.click()
  await expect(dialog.getByRole('alert')).toHaveText('Current password incorrect')
  await dialog.getByLabel('Current password').fill('correct-horse')
  await confirmDelete.click()
  await page.waitForURL('**/login')
  await expect(page.getByText('Your account and everything in it were deleted.')).toBeVisible()
  expect(state.writes.at(-1)).toBe('/v1/users/me {"currentPassword":"correct-horse"}')
  await context.close()

  // If the server finds the sign-in too old, the dialog asks to sign in again and returns to the confirmation.
  const stale = { signedInAt: hoursAgo(72), serverSaysStale: true, writes: [] }
  ;({ context, page } = await open(browser, stale))
  await page.getByRole('button', { name: 'Delete account' }).click()
  await page.getByLabel('Type your email to confirm').fill(email)
  await page.getByRole('button', { name: 'Delete account' }).last().click()
  const signIn = page.getByRole('dialog', { name: 'Sign in again to continue' })
  await expect(signIn.getByRole('button', { name: 'Continue with GitHub' })).toBeVisible()
  if (shots) await page.screenshot({ path: `${shots}/account-sign-in-again.png` })
  stale.serverSaysStale = false
  await signIn.getByRole('button', { name: 'Continue with Google' }).click()
  await expect(page.getByRole('dialog', { name: 'Delete your Cabinet account?' })).toBeVisible()
  expect(stale.writes.at(-1)).toMatch(/^\/sign-in\/social .*"provider":"google".*tab=account&delete=1/)
  expect(new URL(page.url()).searchParams.get('delete')).toBeNull()
  await context.close()
  console.log('PASS: account tab no longer lists sign-in methods; delete account confirms by email, signs out, and re-authenticates when the server asks')
} finally {
  await browser.close()
}
