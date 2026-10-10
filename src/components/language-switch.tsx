import { ActionForm } from "@/components/action-form";
import { setLocale } from "@/lib/actions";
import { getDict } from "@/lib/i18n";

// One-click toggle between English and Arabic (stored in a cookie).
export async function LanguageSwitch({ className = "", dark = false }: { className?: string; dark?: boolean }) {
  const t = await getDict();
  return (
    // The error floats under the button so it doesn't push the header around.
    <ActionForm
      action={setLocale}
      className={`relative ${className}`}
      errorClassName={`absolute end-0 top-full z-20 w-56 rounded-lg border p-2 shadow-lg ${dark ? "border-white/10 bg-deep text-error" : "border-line bg-white text-red-600"}`}
    >
      <button
        type="submit"
        name="locale"
        value={t.locale === "ar" ? "en" : "ar"}
        className={`btn btn-sm whitespace-nowrap border ${dark ? "border-cream/30 text-cream hover:border-gold hover:text-gold-light" : "border-line bg-white text-espresso hover:border-gold hover:text-gold-deep"}`}
        lang={t.locale === "ar" ? "en" : "ar"}
      >
        {t.switchLabel}
      </button>
    </ActionForm>
  );
}
