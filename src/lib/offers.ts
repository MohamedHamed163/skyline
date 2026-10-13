import type { Dict } from "./i18n/en";
import { fmt } from "./i18n/shared";
import { parseSearch, searchHref } from "./search";
import type { ListingType } from "./types";

// The two Skyline offers shown above the home-page hero (docs/offers.md).

export type Offer = { listing: ListingType; /** In percent. */ rate: number };

/** The rates live only here; the dictionary copy uses {rate}, so the figures can never disagree. */
export const OFFERS: readonly Offer[] = [
  { listing: "primary", rate: 1 }, // cashback
  { listing: "resale", rate: 0.5 }, // commission
];

/** 1 → "1%", 0.5 → "0.5%" (Western digits in both languages, like prices). */
export const formatRate = (rate: number) => `${rate}%`;

/**
 * Everything a card shows for one offer. The highlight is split around the figure so the
 * figure can be set large, with the words before/after it ("Only" … "commission") set small.
 */
export function offerDetails(t: Pick<Dict, "home">, offer: Offer) {
  const copy = t.home.offers[offer.listing];
  const rate = formatRate(offer.rate);
  const [before = "", after = ""] = copy.highlight.split("{rate}");
  return {
    href: searchHref(parseSearch({}), { listing: offer.listing }),
    headline: fmt(copy.headline, { rate }),
    text: fmt(copy.text, { rate }),
    highlight: { before: before.trim(), figure: rate, after: after.trim() },
  };
}
