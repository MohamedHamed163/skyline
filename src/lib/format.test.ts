import { describe, expect, it } from "vitest";
import { floorText } from "./format";
import ar from "./i18n/ar";
import en from "./i18n/en";

describe("floorText", () => {
  it("calls floor 0 the ground floor", () => {
    expect(floorText(en, 0)).toBe("Ground floor");
    expect(floorText(ar, 0)).toBe("الطابق الأرضي");
  });

  it("numbers every other floor", () => {
    expect(floorText(en, 3)).toBe("Floor 3");
    expect(floorText(en, 45)).toBe("Floor 45");
    expect(floorText(ar, 3)).toBe("الطابق 3");
  });
});
