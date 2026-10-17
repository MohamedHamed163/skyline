# Site header

The sticky espresso bar at the top of every public page (`SiteHeader` in
`src/components/site-chrome.tsx`): the logo, the 7 menu links (Properties, Primary, Resale, Rent,
Projects, About, Contact), the language switch, **My account** for signed-in hosts
(see [host-accounts.md](host-accounts.md)) and **List a property**.

The header must never make the page scroll sideways, from 360px phones to 1440px desktops, in
English and Arabic, signed in or out. The 7 links need about 520px, so they only share the top row
with the buttons on wide screens.

## Layout by width

| Width | Top row | Second row |
| --- | --- | --- |
| Below 640px (phones) | Smaller logo, language switch and a compact **List a property** that stays on one line | **My account** (signed in) then the 7 links, scrolling sideways |
| 640–1023px (tablets) | Full-size logo, language switch, **My account** with its label, **List a property** | The 7 links (they fit without scrolling from about 600px) |
| 1024–1279px | Logo, the 7 links (slightly tighter padding), language switch, **My account** as an icon, **List a property** | none |
| 1280px and up | Same, with normal link padding and the **My account** label | none |

The second row scrolls inside itself (`overflow-x-auto`), so it never widens the page. Measured
with the fix, the tightest case is a signed-in English header at 1024px, with about 36px to spare,
so a 15–17px desktop scrollbar still fits.

## Active menu item

Both menu rows use `NavMenu`, so the open page's link is highlighted and marked
`aria-current="page"` wherever the links are shown (rules in [rate-limiting.md](rate-limiting.md#3-active-navbar-item-client),
`activeHref` in `src/lib/nav.ts`). On phones **My account** is its own `NavMenu`, highlighted on
`/account` pages.

## Code map

| File | Role |
| --- | --- |
| `src/components/site-chrome.tsx` | `SiteHeader` (breakpoints: second row `lg:hidden`, inline menu `lg:flex`, account button `sm:inline-flex`, compact button `max-sm:`), `Logo` (`imageClassName` sets the logo height; the admin keeps the default `h-10`). |
| `src/components/nav-link.tsx` | `NavLink`, `NavMenu`. |
| `src/lib/nav.ts` | `activeHref`, `isCurrentUrl`. |

## Tests

Layout only, so there is no unit test; `src/lib/nav.test.ts` still covers the highlight rules. To
check by hand, open any page at 360, 375, 768, 800, 1024, 1280 and 1440px wide in both languages
(signed in and out) and confirm `document.documentElement.scrollWidth === innerWidth` in the console.
