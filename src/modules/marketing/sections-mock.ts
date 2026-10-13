/**
 * Demo data for the Marketing sub-sections (clients, accounts, campaigns, budgets, channels).
 * Amounts are in SAR, like the rest of the demo.
 */

type Localized = { ar: string; en: string };

export type Client = {
  id: string;
  name: Localized;
  industry: Localized;
  manager: Localized;
  activeCampaigns: number;
  monthlyBudget: number;
  status: "active" | "onboarding" | "paused";
  /** Link to the signed contract (PDF); missing while there is none */
  contractUrl?: string;
};

/** Demo contract (the real one comes from storage via getAttachmentUrl(client.contractPath)). */
const DEMO_CONTRACT = "/demo/contract-sample.pdf";

export const clients: Client[] = [
  { id: "c1", name: { ar: "مخبز الصباح", en: "Morning Bakery" }, industry: { ar: "أغذية ومطاعم", en: "Food & restaurants" }, manager: { ar: "مريم سامي", en: "Mariam Sami" }, activeCampaigns: 2, monthlyBudget: 18000, status: "active", contractUrl: DEMO_CONTRACT },
  { id: "c2", name: { ar: "عيادات نور", en: "Nour Clinics" }, industry: { ar: "صحة", en: "Healthcare" }, manager: { ar: "كريم عادل", en: "Karim Adel" }, activeCampaigns: 1, monthlyBudget: 25000, status: "active", contractUrl: DEMO_CONTRACT },
  { id: "c3", name: { ar: "أكاديمية المسار", en: "Al Masar Academy" }, industry: { ar: "تعليم وتدريب", en: "Education & training" }, manager: { ar: "مريم سامي", en: "Mariam Sami" }, activeCampaigns: 3, monthlyBudget: 32000, status: "active", contractUrl: DEMO_CONTRACT },
  { id: "c4", name: { ar: "بيت الديكور", en: "Decor House" }, industry: { ar: "تجزئة", en: "Retail" }, manager: { ar: "عمر حسن", en: "Omar Hassan" }, activeCampaigns: 0, monthlyBudget: 12000, status: "onboarding", contractUrl: DEMO_CONTRACT },
  { id: "c5", name: { ar: "تطبيق مشوار", en: "Mishwar App" }, industry: { ar: "تقنية", en: "Technology" }, manager: { ar: "كريم عادل", en: "Karim Adel" }, activeCampaigns: 0, monthlyBudget: 20000, status: "paused" },
];

export type Platform = "Instagram" | "TikTok" | "Snapchat" | "X" | "Google Ads" | "LinkedIn" | "Facebook" | "Email";

export type SocialAccount = {
  id: string;
  platform: Platform;
  handle: string;
  clientId: string;
  followers: number;
  status: "connected" | "attention" | "disconnected";
  lastPost: Localized;
};

export const accounts: SocialAccount[] = [
  { id: "a1", platform: "Instagram", handle: "@morning.bakery", clientId: "c1", followers: 48200, status: "connected", lastPost: { ar: "من ساعتين", en: "2 hours ago" } },
  { id: "a2", platform: "TikTok", handle: "@morningbakery", clientId: "c1", followers: 91500, status: "connected", lastPost: { ar: "أمس", en: "Yesterday" } },
  { id: "a3", platform: "Snapchat", handle: "nour.clinics", clientId: "c2", followers: 22800, status: "attention", lastPost: { ar: "من ٥ أيام", en: "5 days ago" } },
  { id: "a4", platform: "Google Ads", handle: "Nour Clinics — Search", clientId: "c2", followers: 0, status: "connected", lastPost: { ar: "حملة شغالة", en: "Campaign running" } },
  { id: "a5", platform: "LinkedIn", handle: "Al Masar Academy", clientId: "c3", followers: 13400, status: "connected", lastPost: { ar: "من ٣ أيام", en: "3 days ago" } },
  { id: "a6", platform: "X", handle: "@mishwar_app", clientId: "c5", followers: 30900, status: "disconnected", lastPost: { ar: "من شهر", en: "A month ago" } },
];

export type CampaignStage = "planning" | "running" | "review" | "done";

export type Campaign = {
  id: string;
  name: Localized;
  clientId: string;
  channels: Platform[];
  stage: CampaignStage;
  progress: number;
  start: string;
  end: string;
  spent: number;
};

export const campaigns: Campaign[] = [
  { id: "k1", name: { ar: "إطلاق منيو الشتاء", en: "Winter menu launch" }, clientId: "c1", channels: ["Instagram", "TikTok"], stage: "running", progress: 0.55, start: "2026-10-01", end: "2026-10-31", spent: 9800 },
  { id: "k2", name: { ar: "حجوزات الكشف المجاني", en: "Free check-up bookings" }, clientId: "c2", channels: ["Google Ads", "Snapchat"], stage: "running", progress: 0.4, start: "2026-10-05", end: "2026-11-05", spent: 11200 },
  { id: "k3", name: { ar: "تسجيل دفعة نوفمبر", en: "November cohort enrollment" }, clientId: "c3", channels: ["LinkedIn", "Instagram"], stage: "review", progress: 0.85, start: "2026-09-15", end: "2026-10-20", spent: 21500 },
  { id: "k4", name: { ar: "اليوم المفتوح", en: "Open day" }, clientId: "c3", channels: ["Email"], stage: "planning", progress: 0.1, start: "2026-11-01", end: "2026-11-10", spent: 0 },
  { id: "k5", name: { ar: "عرض الافتتاح", en: "Grand opening offer" }, clientId: "c1", channels: ["Instagram"], stage: "done", progress: 1, start: "2026-08-20", end: "2026-09-10", spent: 14300 },
];

/** Monthly budget vs spend per client (this month) */
export const budgets: { clientId: string; allocated: number; spent: number }[] = [
  { clientId: "c1", allocated: 18000, spent: 12600 },
  { clientId: "c2", allocated: 25000, spent: 11200 },
  { clientId: "c3", allocated: 32000, spent: 29400 },
  { clientId: "c4", allocated: 12000, spent: 0 },
  { clientId: "c5", allocated: 20000, spent: 2100 },
];

export type ChannelStat = {
  platform: Platform;
  campaigns: number;
  reach: number;
  costPerResult: number;
  conversion: number;
  spendShare: number;
};

export const channels: ChannelStat[] = [
  { platform: "Instagram", campaigns: 3, reach: 412000, costPerResult: 4.2, conversion: 3.1, spendShare: 0.32 },
  { platform: "TikTok", campaigns: 1, reach: 655000, costPerResult: 2.8, conversion: 2.4, spendShare: 0.18 },
  { platform: "Google Ads", campaigns: 1, reach: 98000, costPerResult: 11.5, conversion: 6.8, spendShare: 0.22 },
  { platform: "Snapchat", campaigns: 1, reach: 187000, costPerResult: 3.6, conversion: 1.9, spendShare: 0.11 },
  { platform: "LinkedIn", campaigns: 1, reach: 54000, costPerResult: 18.9, conversion: 4.5, spendShare: 0.13 },
  { platform: "Email", campaigns: 1, reach: 21000, costPerResult: 0.6, conversion: 8.2, spendShare: 0.04 },
];
