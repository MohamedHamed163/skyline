import Link from "next/link";
import { ExchangeIcon, WalletIcon } from "@/components/icons";
import type { Dict } from "@/lib/i18n";
import { OFFERS, offerDetails, type Offer } from "@/lib/offers";

const ICONS = { primary: WalletIcon, resale: ExchangeIcon } as const;

/** One offer: the rate as the large figure, then the headline and supporting line. Links to the matching listings. */
export function OfferCard({ t, offer }: { t: Dict; offer: Offer }) {
  const o = offerDetails(t, offer);
  const Icon = ICONS[offer.listing];
  return (
    <Link
      href={o.href}
      className="group flex h-full items-center gap-4 rounded-2xl border border-gold/20 bg-white/[0.04] p-4 shadow-lg shadow-black/10 transition duration-300 hover:border-gold/50 hover:bg-white/[0.07] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold motion-safe:hover:-translate-y-0.5 sm:gap-5 sm:p-5"
    >
      <p className="flex w-28 shrink-0 flex-col items-center text-center xl:w-36">
        {o.highlight.before && <span className="eyebrow-light mb-1.5 text-cream/75">{o.highlight.before}</span>}
        <span className="text-4xl font-extrabold leading-none tracking-tight text-gold-light xl:text-5xl">{o.highlight.figure}</span>
        {o.highlight.after && <span className="eyebrow-light mt-1.5 text-cream/75">{o.highlight.after}</span>}
      </p>
      <div className="flex min-w-0 flex-col justify-center self-stretch border-s border-white/10 ps-4 sm:ps-5">
        <p className="eyebrow-light hidden items-center gap-1.5 sm:flex">
          <Icon className="text-gold" /> {t.listing[offer.listing]}
        </p>
        <h3 className="text-base font-bold leading-snug sm:mt-1.5 lg:text-lg">{o.headline}</h3>
        {/* Kept for screen readers on phones, where only the figure and headline are shown. */}
        <p className="sr-only text-sm text-cream/75 sm:not-sr-only sm:mt-1">{o.text}</p>
      </div>
    </Link>
  );
}

/** The offers band between the navbar and the home-page hero (docs/offers.md). */
export function Offers({ t }: { t: Dict }) {
  return (
    <section aria-labelledby="offers-title" className="border-b border-white/10 bg-espresso py-4 text-cream sm:py-5">
      <h2 id="offers-title" className="sr-only">
        {t.home.offers.title}
      </h2>
      <ul className="container-page grid auto-rows-fr gap-3 sm:gap-4 lg:grid-cols-2 lg:gap-5">
        {OFFERS.map((offer) => (
          <li key={offer.listing}>
            <OfferCard t={t} offer={offer} />
          </li>
        ))}
      </ul>
    </section>
  );
}
