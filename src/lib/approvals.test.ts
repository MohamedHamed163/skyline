import { describe, expect, it } from "vitest";
import { makeProperty } from "@/test/fixtures";
import { PROPERTY_STATUSES } from "./types";
import { awaitsApproval, publishesOnSave } from "./approvals";

describe("awaitsApproval", () => {
  it("keeps pending sales in Pending Approvals", () => {
    expect(awaitsApproval(makeProperty({ status: "pending", purpose: "sale" }))).toBe(true);
  });

  it("never lists a rental, whatever its status", () => {
    for (const status of PROPERTY_STATUSES) expect(awaitsApproval(makeProperty({ status, purpose: "rent" }))).toBe(false);
  });

  it("leaves out sales that aren't pending", () => {
    for (const status of PROPERTY_STATUSES.filter((s) => s !== "pending")) {
      expect(awaitsApproval(makeProperty({ status, purpose: "sale" }))).toBe(false);
    }
  });
});

describe("publishesOnSave", () => {
  it("publishes a pending listing saved as a rental", () => {
    expect(publishesOnSave({ status: "pending" }, { purpose: "rent" })).toBe(true);
  });

  it("keeps a pending sale waiting", () => {
    expect(publishesOnSave({ status: "pending" }, { purpose: "sale" })).toBe(false);
  });

  it("leaves rentals in any other status alone", () => {
    for (const status of PROPERTY_STATUSES.filter((s) => s !== "pending")) {
      expect(publishesOnSave({ status }, { purpose: "rent" })).toBe(false);
    }
  });
});
