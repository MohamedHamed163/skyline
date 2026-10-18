import { SETTABLE_LEAD_STATUSES, type LeadStatus } from "./types";

/**
 * What saving a lead's status form writes (docs/lead-statuses.md). Only Contacted and
 * Not Interested can be set; anything else (the hidden "New" placeholder, an old status)
 * leaves the status alone and saves the notes only.
 */
export function leadPatch(status: string, notes: string): { status?: LeadStatus; notes: string } {
  const settable = SETTABLE_LEAD_STATUSES.find((s) => s === status);
  return settable ? { status: settable, notes } : { notes };
}
