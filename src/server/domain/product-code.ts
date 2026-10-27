/** "BO" + 55 -> "BO-055"; widens past 999. */
export function formatProductCode(prefix: string, seq: number): string {
  return `${prefix}-${String(seq).padStart(3, "0")}`;
}

export const PREFIX_RE = /^[A-Z]{1,6}$/;

/**
 * Suggests a code prefix from a category name (the owner can edit it): initials of each word
 * without Vietnamese marks, e.g. "Hoa cưới" -> "HC", "Bó hoa sinh nhật" -> "BHSN".
 * A single word keeps its first 3 letters ("Kệ" -> "KE").
 */
export function suggestPrefix(name: string): string {
  const plain = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase()
    .replace(/[^A-Z\s]/g, " ")
    .trim();
  const words = plain.split(/\s+/).filter(Boolean);
  if (!words.length) return "SP";
  if (words.length === 1) return words[0].slice(0, 3);
  return words.map((w) => w[0]).join("").slice(0, 6);
}
