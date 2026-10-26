/**
 * A WhatsApp number as international digits (what wa.me expects), or null when it cannot be one.
 * "+20 101 234 5678", "0020…", and local Egyptian "01xxxxxxxxx" all become "201012345678".
 */
export function normalizePhone(input: string | null | undefined): string | null {
  let digits = (input ?? "").replace(/[^\d]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (/^01\d{9}$/.test(digits)) digits = "2" + digits;
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}
