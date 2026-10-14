/** Team notes in the Operations room, optionally attached to an operation (demo data until the backend exists). */

/** Who a note is for: the whole company, or specific departments and/or employees. */
export type NoteAudience =
  | { type: "company" }
  | { type: "custom"; departmentIds: string[]; memberIds: string[] };

export type Note = {
  id: string;
  text: string;
  authorId: string;
  createdAt: string;
  /** Optional operation (row id in the operations log) this note is about */
  operationId?: string;
  audience: NoteAudience;
  pinned: boolean;
  /** Files attached to the note. `url` opens it (a signed link, or a local preview in the demo). */
  attachments?: { path: string; name: string; size: number; type: string; url?: string }[];
};

/** A note concerns a department if it's company-wide, addressed to it, or addressed to one of its members. */
export function noteConcernsDepartment(note: Note, departmentId: string, memberDepartment: (memberId: string) => string | undefined) {
  if (note.audience.type === "company") return true;
  return (
    note.audience.departmentIds.includes(departmentId) ||
    note.audience.memberIds.some((id) => memberDepartment(id) === departmentId)
  );
}

export const notes: Note[] = [
  {
    id: "n1",
    text: "المورد طلب تأكيد الكميات قبل الخميس عشان يلحق الشحنة.",
    authorId: "m2",
    createdAt: "2026-10-11T10:20:00",
    operationId: "w5",
    audience: { type: "custom", departmentIds: ["d-projects"], memberIds: ["m7"] },
    pinned: true,
  },
  {
    id: "n2",
    text: "المقاول محتاج نسخة من شهادة الإنجاز قبل صرف الدفعة.",
    authorId: "m7",
    createdAt: "2026-10-10T15:05:00",
    operationId: "w4",
    audience: { type: "custom", departmentIds: [], memberIds: ["m1", "m2"] },
    pinned: false,
  },
  {
    id: "n3",
    text: "أي عقد فوق 50,000 ر.س لازم يعدّي على المستشار القانوني الأول.",
    authorId: "m1",
    createdAt: "2026-10-09T11:40:00",
    audience: { type: "company" },
    pinned: false,
  },
];
