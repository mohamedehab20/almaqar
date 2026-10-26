/**
 * What a client sees in their portal, chosen by the company per client («بوابة العملاء»). The database enforces
 * it too (drizzle/0038: briefs RLS, portal_invoices, portal_meetings). Pure, shared by server and screens.
 */
export const PORTAL_FEATURES = ["briefs", "invoices", "meetings", "files"] as const;
export type PortalFeature = (typeof PORTAL_FEATURES)[number];

/** A client starts with the whole portal; a visitor who only comes to a meeting sees their meetings. */
export const defaultAccess = (kind: "client" | "visitor"): PortalFeature[] => (kind === "visitor" ? ["meetings"] : [...PORTAL_FEATURES]);

/** Known features only, in the standard order, without repeats. */
export const cleanAccess = (list: readonly string[]): PortalFeature[] => PORTAL_FEATURES.filter((f) => list.includes(f));
