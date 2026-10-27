/** DH-yymmdd-NNN, widening past 999 orders in a day. `day` is "YYYY-MM-DD" (Vietnam date). */
export function formatOrderCode(day: string, seq: number): string {
  const [y, m, d] = day.split("-");
  return `DH-${y.slice(2)}${m}${d}-${String(seq).padStart(3, "0")}`;
}
