import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"
import { transformSync } from "esbuild"

// Run the dashboard's actual effect without mocking its unrelated UI/auth hooks.
const dashboard = readFileSync(new URL("../src/app/cabinet/cabinet-dashboard.tsx", import.meta.url), "utf8")
const observerAt = dashboard.indexOf("new IntersectionObserver")
assert.ok(observerAt > 0, "dashboard must observe the pagination sentinel")
// The effect is the function passed to the React.useEffect call that creates the observer.
// shortcut: brace matching ignores braces inside strings/comments; fine while the effect has none, else use a parser.
const effectStart = dashboard.lastIndexOf("React.useEffect(", observerAt) + "React.useEffect(".length
let effectEnd = dashboard.indexOf("{", effectStart)
for (let depth = 0; effectEnd < dashboard.length; effectEnd++) {
  if (dashboard[effectEnd] === "{") depth++
  else if (dashboard[effectEnd] === "}" && --depth === 0) break
}
const effectSource = dashboard.slice(effectStart, effectEnd + 1)

function setup(overrides = {}) {
  const observers = []
  const requests = []
  const context = {
    bookmarkScrollRef: { current: {} }, loadMoreRef: { current: {} },
    filterDuplicates: false, hasNextPage: true, isFetchingBookmarks: false, isFetchNextPageError: false,
    fetchNextPage: options => requests.push(options),
    IntersectionObserver: class {
      constructor(callback, options) { this.callback = callback; this.options = options; observers.push(this) }
      observe(target) { this.target = target }
      disconnect() { this.disconnected = true }
    },
    ...overrides,
  }
  const effect = vm.runInNewContext(transformSync(`(${effectSource})`, { loader: "ts" }).code, context)
  return { context, effect, observers, requests }
}

test("loads once near the bottom of the bookmark panel, and re-arms after fetching", () => {
  const { context, effect, observers, requests } = setup()
  const cleanup = effect()
  const observer = observers[0]
  assert.equal(observer.options.root, context.bookmarkScrollRef.current)
  assert.equal(observer.options.rootMargin, "0px 0px 300px 0px")
  assert.equal(observer.target, context.loadMoreRef.current)
  observer.callback([{ isIntersecting: false }])
  assert.equal(requests.length, 0)
  observer.callback([{ isIntersecting: true }])
  observer.callback([{ isIntersecting: true }])
  assert.equal(requests.length, 1)
  assert.equal(requests[0].cancelRefetch, false)
  assert.equal(observer.disconnected, true)
  cleanup()
  context.isFetchingBookmarks = true
  assert.equal(effect(), undefined)
  context.isFetchingBookmarks = false
  effect()
  observers[1].callback([{ isIntersecting: true }])
  assert.equal(requests.length, 2)
})

test("does not load after cleanup, at the end, during errors, or in duplicate view", () => {
  for (const overrides of [
    { hasNextPage: false }, { isFetchingBookmarks: true }, { isFetchNextPageError: true },
    { filterDuplicates: true }, { bookmarkScrollRef: { current: null } }, { loadMoreRef: { current: null } },
  ]) {
    const { effect, observers } = setup(overrides)
    assert.equal(effect(), undefined)
    assert.equal(observers.length, 0)
  }
  const { effect, observers, requests } = setup()
  const cleanup = effect()
  cleanup()
  observers[0].callback([{ isIntersecting: true }])
  assert.equal(requests.length, 0)
})
