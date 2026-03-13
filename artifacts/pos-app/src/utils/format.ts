import { format as dateFnsFormat } from "date-fns";
import { id as idLocale } from "date-fns/locale";

/**
 * Format angka sebagai mata uang Rupiah penuh.
 * Contoh: 1.260.000 → "Rp 1.260.000"
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format angka sebagai mata uang ringkas, disingkat saat menyentuh batas tertentu.
 * Contoh:
 *   18.750.000 → "Rp 18,75JT"
 *   1.500.000  → "Rp 1,5JT"
 *   850.000    → "Rp 850RB"
 *   75.000     → "Rp 75.000"  (di bawah 100RB tetap penuh)
 */
export function formatCurrencyCompact(value: number): string {
  if (value >= 1_000_000_000) {
    const n = value / 1_000_000_000;
    const formatted = trimTrailingZero(n.toFixed(2));
    return `Rp ${formatted}M`;
  }
  if (value >= 1_000_000) {
    const n = value / 1_000_000;
    const formatted = trimTrailingZero(n.toFixed(2));
    return `Rp ${formatted}JT`;
  }
  if (value >= 100_000) {
    const n = value / 1_000;
    const formatted = trimTrailingZero(n.toFixed(1));
    return `Rp ${formatted}RB`;
  }
  return formatCurrency(value);
}

/** Hapus desimal nol yang tidak perlu: "1,50" → "1,5", "2,00" → "2" */
function trimTrailingZero(s: string): string {
  // Ganti titik desimal ke koma (gaya Indonesia)
  const withComma = s.replace(".", ",");
  // Hapus trailing zero setelah koma: "1,50" → "1,5", "2,00" → "2"
  return withComma.replace(/,(\d*?)0+$/, (_, d) => d ? `,${d}` : "");
}

// ── Date helpers ───────────────────────────────────────────────────────────

export function formatDate(iso: string): string {
  try {
    return dateFnsFormat(new Date(iso), "d MMM yyyy", { locale: idLocale });
  } catch {
    return iso;
  }
}

export function formatDateTime(iso: string): string {
  try {
    return dateFnsFormat(new Date(iso), "d MMM yyyy, HH:mm", { locale: idLocale });
  } catch {
    return iso;
  }
}
