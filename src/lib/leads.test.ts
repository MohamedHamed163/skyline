import { describe, expect, it } from "vitest";
import en from "./i18n/en";
import ar from "./i18n/ar";
import { leadPatch } from "./leads";
import { LEAD_STATUSES, SETTABLE_LEAD_STATUSES } from "./types";

describe("lead statuses", () => {
  it("are New, Contacted and Not Interested only", () => {
    expect(LEAD_STATUSES).toEqual(["new", "contacted", "not_interested"]);
    expect(SETTABLE_LEAD_STATUSES).toEqual(["contacted", "not_interested"]);
  });

  it("have a label in both languages and no leftover labels", () => {
    for (const dict of [en, ar]) expect(Object.keys(dict.leadStatus).sort()).toEqual([...LEAD_STATUSES].sort());
  });
});

describe("leadPatch", () => {
  it("sets Contacted or Not Interested", () => {
    expect(leadPatch("contacted", "called")).toEqual({ status: "contacted", notes: "called" });
    expect(leadPatch("not_interested", "")).toEqual({ status: "not_interested", notes: "" });
  });

  it("keeps the status when none is picked, so a new lead can save notes", () => {
    expect(leadPatch("", "budget 8M")).toEqual({ notes: "budget 8M" });
  });

  it("ignores statuses that can't be set by hand, including the removed ones", () => {
    for (const s of ["new", "interested", "viewing_scheduled", "negotiating", "closed", "bogus"]) {
      expect(leadPatch(s, "n")).toEqual({ notes: "n" });
    }
  });
});
