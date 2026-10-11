/**
 * Demo data for the Marketing department page (idea → test → client delivery),
 * until the backend exists. Text is company data, so it is stored per language.
 */

type Localized = { ar: string; en: string };

export type Stage = "bank" | "lab" | "delivery";

export type Criterion = "hook" | "clarity" | "fit" | "effort";
export const criteria: Criterion[] = ["hook", "clarity", "fit", "effort"];

export type Version = {
  id: string;
  label: string;
  description: Localized;
  duration: string;
  views: number;
  completion: number;
  engagement: number;
};

export type DeliveryStatus = "awaiting" | "approved" | "changes";

export type Idea = {
  id: string;
  stage: Stage;
  title: Localized;
  client: Localized;
  format: Localized;
  owner: Localized;
  hook: Localized;
  message: Localized;
  /** Lab only */
  versions?: Version[];
  ratings?: Record<Criterion, number>;
  /** Delivery only */
  delivery?: { status: DeliveryStatus; sentOn: string };
};

const placeholderClient = { ar: "[اسم العميل]", en: "[Client name]" };
const placeholderOwner = { ar: "[اسم المسوّق]", en: "[Marketer name]" };
const reel = { ar: "ريل ٩:١٦", en: "Reel 9:16" };

export const ideas: Idea[] = [
  // ── Test lab ──
  {
    id: "i1",
    stage: "lab",
    title: { ar: "ريل المنبه — «لسه بدري»", en: "Alarm reel — “Still early”" },
    client: placeholderClient,
    format: reel,
    owner: placeholderOwner,
    hook: { ar: "المنبه بيقلب من ٦:٤٣ لـ ٦:٤٤… وانت لسه في السرير.", en: "The alarm flips from 6:43 to 6:44… and you're still in bed." },
    message: { ar: "[الرسالة الأساسية اللي عايزين المشاهد يطلع بيها]", en: "[The core message we want viewers to leave with]" },
    versions: [
      { id: "a", label: "A", description: { ar: "يبدأ بالمنبه بيقلب الرقم", en: "Opens on the alarm flipping" }, duration: "0:05", views: 4210, completion: 61, engagement: 3.4 },
      { id: "b", label: "B", description: { ar: "يبدأ بصوت المنبه قبل الصورة", en: "Opens with the alarm sound first" }, duration: "0:05", views: 6870, completion: 78, engagement: 5.1 },
    ],
    ratings: { hook: 4, clarity: 4, fit: 5, effort: 3 },
  },
  {
    id: "i2",
    stage: "lab",
    title: { ar: "كاروسيل «قبل وبعد» المكتب", en: "Office “before & after” carousel" },
    client: placeholderClient,
    format: { ar: "كاروسيل ٥ صور", en: "5-slide carousel" },
    owner: placeholderOwner,
    hook: { ar: "ده كان مكتبنا من ٣ شهور…", en: "This was our office 3 months ago…" },
    message: { ar: "التنظيم بيوفر وقت الفريق كل يوم.", en: "Organization saves the team time every day." },
    versions: [
      { id: "a", label: "A", description: { ar: "الصورة القديمة الأول", en: "Old photo first" }, duration: "—", views: 2980, completion: 54, engagement: 4.2 },
      { id: "b", label: "B", description: { ar: "النتيجة النهائية الأول", en: "Final result first" }, duration: "—", views: 2410, completion: 47, engagement: 3.1 },
    ],
    ratings: { hook: 3, clarity: 5, fit: 4, effort: 5 },
  },
  {
    id: "i3",
    stage: "lab",
    title: { ar: "ستوري سؤال «إنت مين في الفريق؟»", en: "Story poll “Who are you on the team?”" },
    client: placeholderClient,
    format: { ar: "ستوري تفاعلية", en: "Interactive story" },
    owner: placeholderOwner,
    hook: { ar: "في كل فريق فيه واحد بيصحى قبل المنبه…", en: "Every team has someone who wakes up before the alarm…" },
    message: { ar: "المقر بيجمع الفريق كله في مكان واحد.", en: "Al Maqr brings the whole team into one place." },
    versions: [
      { id: "a", label: "A", description: { ar: "سؤال باختيارين", en: "Two-option poll" }, duration: "0:15", views: 1830, completion: 70, engagement: 9.6 },
      { id: "b", label: "B", description: { ar: "سؤال بأربع اختيارات", en: "Four-option quiz" }, duration: "0:15", views: 1765, completion: 64, engagement: 11.2 },
    ],
    ratings: { hook: 4, clarity: 3, fit: 4, effort: 4 },
  },

  // ── Idea bank ──
  ...[
    { id: "b1", ar: "يوم في حياة موظف ريموت", en: "A day in the life of a remote employee", far: "ريل ٩:١٦", fen: "Reel 9:16" },
    { id: "b2", ar: "٥ أخطاء بتضيّع وقت الاجتماعات", en: "5 mistakes that waste meeting time", far: "كاروسيل", fen: "Carousel" },
    { id: "b3", ar: "تحدي «مكتبك في ١٠ ثواني»", en: "“Your desk in 10 seconds” challenge", far: "ريل ٩:١٦", fen: "Reel 9:16" },
    { id: "b4", ar: "شهادة عميل: أول شهر في المقر", en: "Client story: first month on Al Maqr", far: "فيديو ١:١", fen: "Video 1:1" },
    { id: "b5", ar: "ميم «لما المدير يسأل وصلنا لفين»", en: "Meme: when the boss asks for a status", far: "صورة", fen: "Image" },
  ].map((item): Idea => ({
    id: item.id,
    stage: "bank",
    title: { ar: item.ar, en: item.en },
    client: placeholderClient,
    format: { ar: item.far, en: item.fen },
    owner: placeholderOwner,
    hook: { ar: "—", en: "—" },
    message: { ar: "—", en: "—" },
  })),

  // ── Client delivery ──
  {
    id: "d1",
    stage: "delivery",
    title: { ar: "حملة «رجوع المكتب» — ٣ ريلز", en: "“Back to the office” campaign — 3 reels" },
    client: placeholderClient,
    format: reel,
    owner: placeholderOwner,
    hook: { ar: "—", en: "—" },
    message: { ar: "—", en: "—" },
    delivery: { status: "awaiting", sentOn: "2026-10-08" },
  },
  {
    id: "d2",
    stage: "delivery",
    title: { ar: "بوستات الإطلاق — الأسبوع الأول", en: "Launch posts — week one" },
    client: placeholderClient,
    format: { ar: "٦ بوستات", en: "6 posts" },
    owner: placeholderOwner,
    hook: { ar: "—", en: "—" },
    message: { ar: "—", en: "—" },
    delivery: { status: "approved", sentOn: "2026-10-05" },
  },
  {
    id: "d3",
    stage: "delivery",
    title: { ar: "فيديو تعريفي ٦٠ ثانية", en: "60-second intro video" },
    client: placeholderClient,
    format: { ar: "فيديو ١٦:٩", en: "Video 16:9" },
    owner: placeholderOwner,
    hook: { ar: "—", en: "—" },
    message: { ar: "—", en: "—" },
    delivery: { status: "changes", sentOn: "2026-10-03" },
  },
];
