/**
 * Vietnamese phone numbers are stored as digits starting with 0 ("0935662019").
 * "+84 935 662 019", "84935662019" and "0935.662.019" all normalize to the same value.
 * Returns null when the input cannot be a Vietnamese number (mobile 10 digits, landline 10-11).
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("84") && digits.length >= 11) digits = "0" + digits.slice(2);
  if (!digits.startsWith("0")) return null;
  if (digits.length < 10 || digits.length > 11) return null;
  return digits;
}

/** "0935662019" -> "0935 662 019" */
export function formatPhone(phone: string): string {
  if (phone.length === 10) return `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}`;
  if (phone.length === 11) return `${phone.slice(0, 3)} ${phone.slice(3, 7)} ${phone.slice(7)}`;
  return phone;
}
