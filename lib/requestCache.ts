/**
 * Short-lived read cache for GET requests, so moving between dashboard pages
 * doesn't refetch what was just fetched.
 *
 * The backend sits far enough away that even a trivial endpoint costs a few
 * hundred milliseconds, and pages block on their data — so a plain
 * logs → home → logs round trip paid for the same three requests twice and
 * showed a full-screen loader each time. Entries live for [TTL_MS], which is
 * long enough to cover navigation but short enough that a stale read is never
 * more than half a minute behind.
 *
 * Correctness rests on two rules:
 *  - only successful GETs are stored; a rejected request leaves nothing behind
 *  - any write clears everything, so a mutation is never followed by a stale read
 *
 * Anything that polls for server-side change (a webhook landing, an invite
 * being accepted) must bypass this entirely — see `fresh` at the call sites.
 *
 * Note that a cache hit hands back the *same* object every caller received, so
 * a consumer that sorts or splices a fetched array in place would corrupt what
 * the next reader sees. Nothing does that today — the pages all copy first,
 * e.g. `[...logs].sort(...)` — and it needs to stay that way.
 */
const TTL_MS = 30_000;

type Entry = { value: unknown; storedAt: number };

const entries = new Map<string, Entry>();
const inFlight = new Map<string, Promise<unknown>>();

export function readThrough<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const hit = entries.get(key);
  if (hit && Date.now() - hit.storedAt < TTL_MS) {
    return Promise.resolve(hit.value as T);
  }

  // Two components mounting at once ask for the same thing; let them share the
  // one request rather than racing to fill the same slot.
  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const request = loader()
    .then((value) => {
      entries.set(key, { value, storedAt: Date.now() });
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, request);
  return request;
}

/**
 * Drops every cached read. Called after any write, and on logout so one
 * account's data can never be served to the next.
 *
 * In-flight requests are dropped too: one that started before a write may
 * already be carrying pre-write data, so later callers should ask again.
 */
export function invalidateReadCache() {
  entries.clear();
  inFlight.clear();
}
