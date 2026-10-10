import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { LanguageSwitch } from "@/components/language-switch";
import { LoginForm } from "@/components/login-form";
import { isAdmin } from "@/lib/auth";
import { getDict } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).admin.loginTitle, robots: { index: false } };
}

export default async function AdminLoginPage() {
  if (await isAdmin()) redirect("/admin");
  const { admin: t, siteName } = await getDict();

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="card w-full max-w-sm overflow-hidden">
        <div className="bg-espresso px-8 py-6">
          <Image src="/brand/skyline-logo-stacked.png" alt={siteName} width={1304} height={995} priority className="mx-auto h-28 w-auto" />
        </div>
        <div className="p-8">
        <h1 className="text-center text-xl font-bold">{t.loginTitle}</h1>
        <p className="mb-6 mt-1 text-center text-sm text-cocoa">{t.loginSubtitle}</p>
        <LoginForm />
        <LanguageSwitch className="mt-6 flex justify-center" />
        </div>
      </div>
    </main>
  );
}
