"use client";

import { createContext, useContext } from "react";
import type { Dict } from "./en";

const DictContext = createContext<Dict | null>(null);

export function DictProvider({ dict, children }: { dict: Dict; children: React.ReactNode }) {
  return <DictContext.Provider value={dict}>{children}</DictContext.Provider>;
}

/** Translated strings inside client components. */
export function useDict() {
  const dict = useContext(DictContext);
  if (!dict) throw new Error("useDict must be used inside DictProvider");
  return dict;
}

export { fmt } from "./shared";
