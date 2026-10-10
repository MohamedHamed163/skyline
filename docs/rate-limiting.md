# Rate limiting and repeat-click protection

Three layers keep a flood of requests, whether from someone clicking fast or from a script,
from reaching the database.

## 1. Per-IP rate limits (server)

`src/proxy.ts` runs before every page, client navigation and form submission. It counts requests
per client IP in fixed one-minute windows (`src/lib/rate-limit.ts`). An IP that goes over a limit
gets **`429 Too Many Requests`** with a `Retry-After` header, and the page never renders, so
Postgres is never queried.

| Bucket | What counts | Limit per IP |
| --- | --- | --- |
| `page` | Page loads and client-side navigations (GET/HEAD) | 120 / minute |
| `prefetch` | Link prefetches (`next-router-prefetch` header). A page full of cards prefetches many links at once, so these get their own, larger bucket. | 600 / minute |
| `action` | Form submissions / server actions (any non-GET) | 30 / minute |
| `login` | Admin password attempts, checked inside `adminLogin` | 5 / 15 minutes |

A successful admin login resets that IP's `login` counter. Static files (`/_next/`, `/brand/`,
`/listings/`, icons) are not counted.

To change a limit, edit `LIMITS` in `src/lib/rate-limit.ts`.

### Limits of this layer

- **Counters are per server instance and in memory.** On Vercel, each serverless instance has
  its own counters, and they reset on a cold start. The layer stops a single client hammering an
  instance, but a large distributed attack spread over many instances or IPs gets through. Memory
  is capped at 10,000 tracked keys, so a flood of fake IPs can't exhaust it.
- **The IP comes from `x-forwarded-for`.** Vercel overwrites that header with the real client
  address. If the app is ever self-hosted without a reverse proxy in front, clients can forge it.
- **Many people behind one IP** (an office or a mobile carrier's NAT) share a budget. The
  limits are generous for that reason.

### Recommended: a Vercel Firewall rule

Real DoS protection belongs at the edge, before requests reach the app or count as function
invocations. In the Vercel dashboard → **Firewall → Configure → New rule**:

- *If* Request Path starts with `/` → **Rate limit**, fixed window 60s, 300 requests, key: IP,
  action: Deny (or Challenge).
- During an active attack, turn on **Attack Challenge Mode**.

The in-app limits stay in place as a second line of defence.

If you need shared, exact counters across instances, swap the `Map` inside `RateLimiter` for a
shared store such as Upstash Redis (`@upstash/ratelimit`). The `hit()` / `reset()` API stays the same.

## 2. Clicking the page you're already on does nothing (client)

Navbar, footer and logo links use `NavLink` (`src/components/nav-link.tsx`). When a link points
at **exactly** the URL already open (same path and same query, in any parameter order), a plain
click is cancelled, and no request is sent. Notes:

- Ctrl/Cmd/Shift/Alt/middle clicks still open the link in a new tab or window.
- "Properties" while viewing `/properties?type=villa` still navigates, because it clears the filters.
- This is a UX and bandwidth win only. It is **not** security, since a script never clicks links. Layer 1 is the protection.

## 3. Active navbar item (client)

`NavMenu` highlights the item for the open page and marks it `aria-current="page"` for screen
readers. Both the public header and the admin sidebar use it. The most specific match wins
(`activeHref` in `src/lib/nav.ts`):

| Current URL | Highlighted |
| --- | --- |
| `/properties?listing=premium&type=villa` | Premium |
| `/properties?type=villa` | Properties |
| `/properties/SKY-PRM-0001` | Properties |
| `/admin/leads` | Leads (not Dashboard) |
| `/` or `/submit` | nothing |

## Tests

```bash
npm test
```

- `src/lib/rate-limit.test.ts`: windows, reset, per-key isolation, memory cap, IP and bucket detection
- `src/proxy.test.ts`: 429 responses and headers, per-IP and per-bucket isolation
- `src/lib/login-limit.test.ts`: login lockout, other IPs unaffected, reset on success
- `src/lib/nav.test.ts`: same-URL detection and active-item matching
