import assert from "node:assert/strict"
import test from "node:test"
import {
  AXIOS_INSTANCE,
  isRateLimited,
  getRateLimitCooldown,
  setRateLimitCooldown,
  resetRateLimitCooldown,
} from "../src/lib/api-client.ts"

test("rate limit cooldown tracks remaining seconds and blocks requests", async () => {
  resetRateLimitCooldown()
  assert.equal(isRateLimited(), false)
  assert.equal(getRateLimitCooldown(), 0)

  setRateLimitCooldown(5)
  assert.equal(isRateLimited(), true)
  assert.ok(getRateLimitCooldown() >= 4 && getRateLimitCooldown() <= 5)

  // Requests while throttled must reject early with RateLimitCooldownError without hitting network
  await assert.rejects(
    async () => {
      await AXIOS_INSTANCE.get("/test-throttled")
    },
    (err) => {
      assert.equal(err.name, "RateLimitCooldownError")
      assert.equal(err.response?.status, 429)
      assert.equal(err.response?.data?.error?.code, "RATE_LIMIT_COOLDOWN")
      return true
    }
  )

  resetRateLimitCooldown()
  assert.equal(isRateLimited(), false)
  assert.equal(getRateLimitCooldown(), 0)
})

test("response interceptor sets cooldown from Retry-After header on 429 response", async () => {
  resetRateLimitCooldown()
  assert.equal(isRateLimited(), false)

  // Simulate an Axios 429 response error passing through response interceptor
  const mock429Error = {
    response: {
      status: 429,
      headers: { "retry-after": "4" },
      data: {
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests. Please slow down and try again later.",
          retryAfterSeconds: 4,
        },
      },
    },
  }

  // Trigger response error handler registered on AXIOS_INSTANCE
  const responseInterceptor =
    AXIOS_INSTANCE.interceptors.response.handlers.at(-1)
  assert.ok(responseInterceptor?.rejected)

  try {
    await responseInterceptor.rejected(mock429Error)
  } catch (e) {
    assert.equal(e, mock429Error)
  }

  assert.equal(isRateLimited(), true)
  assert.ok(getRateLimitCooldown() >= 3 && getRateLimitCooldown() <= 4)

  resetRateLimitCooldown()
  assert.equal(isRateLimited(), false)
})
