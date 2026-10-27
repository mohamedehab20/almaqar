/**
 * What a person sees in their portal, chosen by the company per person («بوابة العملاء»). The database enforces
 * it too (drizzle/0038 and 0041: briefs RLS and the portal readers). Pure, shared by server and screens.
 */
export const PORTAL_FEATURES = ["briefs", "invoices", "meetings", "files", "operation", "application"] as const;
export type PortalFeature = (typeof PORTAL_FEATURES)[number];

/** Who enters through the visitor login */
export const CLIENT_KINDS = ["client", "visitor", "operation", "candidate"] as const;
export type ClientKind = (typeof CLIENT_KINDS)[number];

/** The parts that make sense for each kind (others stay off and are not offered). */
export const FEATURES_BY_KIND: Record<ClientKind, PortalFeature[]> = {
  client: ["briefs", "invoices", "meetings", "files"],
  visitor: ["meetings", "files"],
  operation: ["operation", "meetings", "files", "invoices"],
  candidate: ["application", "meetings"],
};

/** What a new person starts with. */
export const defaultAccess = (kind: ClientKind): PortalFeature[] =>
  kind === "visitor" ? ["meetings"] : kind === "operation" ? ["operation", "meetings"] : [...FEATURES_BY_KIND[kind]];

/** Known features only, in the standard order, without repeats. */
export const cleanAccess = (list: readonly string[]): PortalFeature[] => PORTAL_FEATURES.filter((f) => list.includes(f));
