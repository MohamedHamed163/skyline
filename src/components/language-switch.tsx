import { setLocale } from "@/lib/actions";
import { getDict } from "@/lib/i18n";

// One-click toggle between English and Arabic (stored in a cookie).
export async function LanguageSwitch({ className = "", dark = false }: { className?: string; dark?: boolean }) {
  const t = await getDict();
  return (
    <form action={setLocale} className={className}>
      <button
        type="submit"
        name="locale"
        value={t.locale === "ar" ? "en" : "ar"}
        className={`btn btn-sm whitespace-nowrap border ${dark ? "border-cream/30 text-cream hover:border-gold hover:text-gold-light" : "border-line bg-white text-espresso hover:border-gold hover:text-gold-deep"}`}
        lang={t.locale === "ar" ? "en" : "ar"}
      >
        {t.switchLabel}
      </button>
    </form>
  );
}
