import { z } from "zod";

/** Shared Zod pieces for action inputs. */
export const id = z.uuid();

const text = (max: number) => z.string().trim().max(max);

/** Bilingual text. Either language may be empty, but not both. */
export const localized = (max = 200) =>
  z.object({ ar: text(max), en: text(max) }).refine((v) => v.ar !== "" || v.en !== "", "Text is required");

/** Bilingual text that may be left empty */
export const optionalLocalized = (max = 200) => z.object({ ar: text(max), en: text(max) });

/** yyyy-mm-dd */
export const isoDate = z.iso.date();

export const companyInput = z.object({ companyId: id });
