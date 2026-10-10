import type { Metadata } from "next";
import { Cairo, Plus_Jakarta_Sans } from "next/font/google";
import { DictProvider } from "@/lib/i18n/client";
import { getDict } from "@/lib/i18n";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });
const cairo = Cairo({ variable: "--font-cairo", subsets: ["arabic", "latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDict();
  return {
    title: { default: t.meta.title, template: `%s · ${t.siteName}` },
    description: t.meta.description,
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const t = await getDict();
  return (
    <html lang={t.locale} dir={t.dir} className={`${jakarta.variable} ${cairo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <DictProvider dict={t}>{children}</DictProvider>
      </body>
    </html>
  );
}
