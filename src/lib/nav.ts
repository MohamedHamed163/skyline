// Which navbar item matches the current URL. Pure functions, used by components/nav-link.tsx.

type Current = { pathname: string; search: URLSearchParams };

function split(href: string) {
  const url = new URL(href, "http://x");
  return { pathname: url.pathname, search: url.searchParams };
}

function sortedQuery(params: URLSearchParams) {
  const copy = new URLSearchParams(params);
  copy.sort();
  return copy.toString();
}

/** True when following `href` would load exactly the page already on screen. */
export function isCurrentUrl(href: string, current: Current) {
  const target = split(href);
  return target.pathname === current.pathname && sortedQuery(target.search) === sortedQuery(current.search);
}

/** How well `href` describes the current page: null if it doesn't, higher is more specific. */
function score(href: string, { pathname, search }: Current) {
  const target = split(href);
  const underPath = pathname === target.pathname || pathname.startsWith(`${target.pathname.replace(/\/$/, "")}/`);
  if (!underPath) return null;
  for (const [key, value] of target.search) if (search.get(key) !== value) return null;
  return target.pathname.length * 100 + [...target.search.keys()].length;
}

/**
 * The single nav href to highlight for the current page: the most specific one that
 * matches. On /properties?listing=primary&type=villa that is "Primary", not "Properties";
 * on /properties/SKY-PRM-0001 it is "Properties"; on /admin/leads it is "Leads", not "Dashboard".
 */
export function activeHref(hrefs: readonly string[], current: Current) {
  let best: string | null = null;
  let bestScore = -1;
  for (const href of hrefs) {
    const s = score(href, current);
    if (s !== null && s > bestScore) [best, bestScore] = [href, s];
  }
  return best;
}
