import type { Property } from "./types";

/**
 * Whether a listing waits in Pending Approvals (docs/pending-approvals.md). Only sales sent by brokers
 * and owners are reviewed; Skyline lists rentals itself and they go live straight away.
 */
export const awaitsApproval = (p: Pick<Property, "status" | "purpose">) => p.status === "pending" && p.purpose === "sale";

/**
 * Whether an admin save leaves a rental that still needs publishing: a pending submission the admin
 * switched to Rent. It is published (and given a SKY-RNT code) instead of waiting for review.
 */
export const publishesOnSave = (before: Pick<Property, "status">, after: Pick<Property, "purpose">) =>
  before.status === "pending" && after.purpose === "rent";
