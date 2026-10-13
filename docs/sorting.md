# Sorting search results

The "Sort by" dropdown on `/properties` orders the results by newest (default), price low → high,
price high → low or largest area. Rentals whose price changes by date sort (and filter) by their
"From" price, the one on their card ([rental-pricing.md](rental-pricing.md)).

## User behaviour

- Picking an option applies it straight away. There is no Apply button.
- Every active filter and the search text are kept, and the page resets to 1.
- While the new results load, the dropdown is disabled and shows a spinner in place of its arrow,
  and the results grid fades to half opacity and ignores clicks.
- The sort lives in the URL (`?sort=price_asc`). `newest` is the default and is left out of the URL.
  The filter sidebar keeps the current sort when filters are applied.
- The dropdown uses a custom chevron (on the end side, so it flips in Arabic) and sizes itself to the
  selected label (`field-sizing: content`), so the arrow sits right after the text. Browsers without
  `field-sizing` fall back to the width of the longest option.

## Data model

None. Sorting runs in memory over the cached published list (see [caching.md](caching.md)).

## Code map

| File | Role |
| --- | --- |
| `src/lib/search.ts` | `SORTS`, `parseSearch` (reads `sort`), `applySearch` (orders results), `sortHrefs` (URL per sort order). |
| `src/components/sort-select.tsx` | Client dropdown. Navigates with `router.push` inside `useTransition`; sets `data-pending` while loading. |
| `src/app/(site)/properties/page.tsx` | Renders `SortSelect` with `sortHrefs(query)`. The results `<section>` is `group/results` and the grid dims via `group-has-data-pending/results:`. |

## Tests

`src/lib/search.test.ts` → `sortHrefs`: one URL per order, filters kept, page reset, default sort
omitted from the URL.
