# Home-page offers

A band directly under the navbar, above the home-page hero, shows Skyline's two offers side by side:

| Offer | Figure | Headline | Supporting line |
| --- | --- | --- | --- |
| Primary | **1%** cashback | Buy Primary. Get 1% Cashback. | Purchase a primary-market property through Skyline and receive 1% cashback. |
| Resale | **Only 0.5%** commission | Buy or Sell Resale with Just 0.5% Commission. | Skyline charges only 0.5% commission on resale transactions. |

The copy is approved marketing wording. Don't add terms, conditions or other offers without sign-off.

## User behaviour

- Each card shows the rate as its largest element, with the headline and supporting line next to it.
  The Primary card has a wallet icon and the Resale card has an exchange icon.
- Each card links to its listings: `/properties?listing=primary` or `/properties?listing=resale`.
  On hover the border turns gold and the card lifts slightly (no lift with reduced motion). Keyboard
  focus shows a gold outline.
- Layout by screen width:
  - **Phones (< 640px):** the cards are stacked and show only the figure and headline, which keeps
    the band short. The supporting line is still read out by screen readers.
  - **Tablets (640–1023px):** the cards are stacked at full width, with the supporting line.
  - **Desktop (≥ 1024px):** the cards sit side by side, with a larger figure from 1280px.
  - Both cards are always the same height, so neither offer outweighs the other.
- Arabic: the band mirrors right-to-left. The figure keeps Western digits (like prices), and the words
  around it follow Arabic order (عمولة **0.5%** فقط).
- The band is the espresso colour of the navbar, with gold figures, so it reads as part of the page
  header rather than a sale banner.

## Admin behaviour

None. The offers are fixed copy, not admin-managed.

## Changing the copy or rates

- **Rates:** `OFFERS` in `src/lib/offers.ts` is the only place the numbers are written.
- **Wording:** `home.offers` in `src/lib/i18n/en.ts` and `ar.ts`. Every string uses `{rate}` for the
  figure. The `highlight` must contain `{rate}` exactly once, because the card splits it there so it can
  set the figure large and the words around it small. The tests check this.

## Data model

None. There are no database or schema changes.

## Code map

| File | Role |
| --- | --- |
| `src/lib/offers.ts` | `OFFERS` (listing type and rate), `formatRate`, and `offerDetails` (headline, text, highlight split around the figure, and link). Pure, no DB. |
| `src/components/offers.tsx` | `OfferCard` (one card) and `Offers` (the band: a `<section>` with a screen-reader `<h2>` and a list of cards). |
| `src/components/icons.tsx` | `WalletIcon`, `ExchangeIcon`. |
| `src/lib/i18n/en.ts`, `ar.ts` | `home.offers` copy. |
| `src/app/(site)/page.tsx` | Renders `<Offers t={t} />` before the hero. |

## Tests

`src/lib/offers.test.ts`:

- The rates are 1% (Primary) and 0.5% (Resale), with one offer per listing type.
- `formatRate` writes `1%` and `0.5%`.
- The English headline, text and highlight match the approved copy exactly. The highlight in capitals
  is `1% CASHBACK` / `ONLY 0.5% COMMISSION`.
- The Arabic highlight keeps its word order around the figure.
- Each card links to the matching listings.
- Every string in both languages has the rate filled in, and each highlight has exactly one `{rate}`.
