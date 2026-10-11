/** Team notes in the Operations room, optionally attached to an operation (demo data until the backend exists). */

export type Note = {
  id: string;
  text: string;
  authorId: string;
  createdAt: string;
  /** Optional operation (row id in the operations log) this note is about */
  operationId?: string;
  pinned: boolean;
};

export const notes: Note[] = [
  {
    id: "n1",
    text: "المورد طلب تأكيد الكميات قبل الخميس عشان يلحق الشحنة.",
    authorId: "m2",
    createdAt: "2026-10-11T10:20:00",
    operationId: "w5",
    pinned: true,
  },
  {
    id: "n2",
    text: "المقاول محتاج نسخة من شهادة الإنجاز قبل صرف الدفعة.",
    authorId: "m7",
    createdAt: "2026-10-10T15:05:00",
    operationId: "w4",
    pinned: false,
  },
  {
    id: "n3",
    text: "أي عقد فوق 50,000 ر.س لازم يعدّي على المستشار القانوني الأول.",
    authorId: "m1",
    createdAt: "2026-10-09T11:40:00",
    pinned: false,
  },
];
