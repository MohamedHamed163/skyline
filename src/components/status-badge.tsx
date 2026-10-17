import type { PropertyStatus } from "@/lib/types";

// Coloured status pills, shared by the admin dashboard (admin-ui.tsx) and the host's /account pages.

export const TONES = {
  amber: "bg-amber-100 text-amber-800",
  green: "bg-success/15 text-success-deep",
  blue: "bg-info/25 text-espresso",
  red: "bg-red-100 text-red-700",
  violet: "bg-violet-100 text-violet-700",
  gray: "bg-line text-cocoa",
  dark: "bg-espresso text-white",
};

export const STATUS_TONE: Record<PropertyStatus, keyof typeof TONES> = {
  pending: "amber",
  published: "green",
  needs_changes: "violet",
  rejected: "red",
  reserved: "blue",
  sold: "dark",
  archived: "gray",
};

export function Badge({ tone, children }: { tone: keyof typeof TONES; children: React.ReactNode }) {
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]}`}>{children}</span>;
}
