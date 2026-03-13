import { CheckCircle2, MessageCircle, X, ShoppingBag, Bike, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/utils/format";
import { format } from "date-fns";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ReceiptData {
  orderId: number;
  orderDate: string;
  readyDate: string;
  customerName: string;
  customerPhone: string;
  paymentMethod: string;
  fulfillmentMethod: "pickup" | "ojol";
  deliveryAddress: string;
  deliveryFee: number;
  notes: string;
  items: { product_name: string; qty: number; price: number; subtotal: number }[];
  total: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

// storeName is now passed via ReceiptData

function fmtDate(iso: string) {
  try {
    return format(new Date(iso), "dd MMM yyyy, HH:mm");
  } catch {
    return iso;
  }
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "font-bold" : ""}>{value}</span>
    </div>
  );
}

function buildWhatsAppMessage(r: ReceiptData): string {
  const line = "━━━━━━━━━━━━━━━━━";
  const isOjol = r.fulfillmentMethod === "ojol";
  const storeName = r.storeName || "Toko";

  // Item list with subtotals
  const subtotal = r.total - (isOjol ? r.deliveryFee : 0);
  const itemLines = r.items
    .map(i => `  ${i.qty}x ${i.product_name}\n     ${formatCurrency(i.subtotal)}`)
    .join("\n");

  // Fulfillment section
  const fulfillmentSection = isOjol
    ? `*[ANTAR OJOL]*\n` +
      `📦 Alamat : ${r.deliveryAddress || "-"}\n` +
      (r.deliveryFee > 0 ? `💸 Ongkir  : ${formatCurrency(r.deliveryFee)}\n` : "")
    : `*[AMBIL SENDIRI]*\n` +
      (r.storeAddress ? `📍 Lokasi  : ${r.storeAddress}\n` : "") +
      (r.mapsUrl ? `🔗 Maps    : ${r.mapsUrl}\n` : "");

  // Optional notes
  const notesSection = r.notes
    ? `${line}\n📌 Catatan : ${r.notes}\n`
    : "";

  return (
    `*${storeName}*\n` +
    `🧾 Struk Pesanan\n` +
    `${line}\n` +
    `📋 No.      : *#${r.orderId}*\n` +
    `📅 Tgl Order: ${fmtDate(r.orderDate)}\n` +
    `⏰ Siap Pkl : ${fmtDate(r.readyDate)}\n` +
    `${line}\n` +
    `👤 Pelanggan: ${r.customerName}\n` +
    (r.customerPhone ? `📞 Telp    : ${r.customerPhone}\n` : "") +
    `${line}\n` +
    `🛍 *ITEM PESANAN*\n` +
    `${itemLines}\n` +
    `${line}\n` +
    (isOjol && r.deliveryFee > 0
      ? `  Subtotal : ${formatCurrency(subtotal)}\n` +
        `  Ongkir  : ${formatCurrency(r.deliveryFee)}\n`
      : "") +
    `  *TOTAL   : ${formatCurrency(r.total)}*\n` +
    `💳 Bayar   : ${r.paymentMethod}\n` +
    `${line}\n` +
    fulfillmentSection +
    notesSection +
    `${line}\n` +
    `✅ Terima kasih sudah memesan!\n` +
    `Pesanan Anda sedang kami proses. 🙏`
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export function ReceiptModal({
  receipt,
  onClose,
}: {
  receipt: ReceiptData;
  onClose: () => void;
}) {
  const isOjol = receipt.fulfillmentMethod === "ojol";
  const message = buildWhatsAppMessage(receipt);
  // Normalize to Indonesian format: 08xx → 628xx, already 62xx stays
  const rawPhone = receipt.customerPhone.replace(/\D/g, "");
  const phone = rawPhone.startsWith("62") ? rawPhone
    : rawPhone.startsWith("0") ? "62" + rawPhone.slice(1)
    : rawPhone ? "62" + rawPhone : "";
  const waUrl = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="bg-emerald-600/10 border-b border-emerald-500/20 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 size={16} className="text-emerald-400" />
            </div>
            <div>
              <p className="font-bold text-foreground">Order Saved!</p>
              <p className="text-xs text-muted-foreground">Order #{receipt.orderId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Receipt body */}
        <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">

          {/* Store name */}
          <div className="text-center pb-1">
            <p className="font-display font-bold text-lg">{receipt.storeName || "Toko"}</p>
            <p className="text-xs text-muted-foreground">Struk Pesanan</p>
          </div>

          <Separator />

          {/* Order meta */}
          <div className="space-y-1.5 text-sm">
            <Row label="No. Pesanan" value={`#${receipt.orderId}`} bold />
            <Row label="Tanggal" value={fmtDate(receipt.orderDate)} />
            <Row label="Siap Pukul" value={fmtDate(receipt.readyDate)} />
            <Row label="Pelanggan" value={receipt.customerName} />
            {receipt.customerPhone && (
              <Row label="Telepon" value={receipt.customerPhone} />
            )}
          </div>

          <Separator />

          {/* Items */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Item Pesanan
            </p>
            <div className="space-y-1.5">
              {receipt.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{item.qty}×</span>{" "}
                    {item.product_name}
                  </span>
                  <span className="font-medium tabular-nums">{formatCurrency(item.subtotal)}</span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Total */}
          <div className="space-y-1 text-sm">
            {isOjol && receipt.deliveryFee > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatCurrency(receipt.total - receipt.deliveryFee)}</span>
              </div>
            )}
            {isOjol && (
              <div className="flex justify-between text-muted-foreground">
                <span>Ongkir</span>
                <span className="tabular-nums">{formatCurrency(receipt.deliveryFee)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base">
              <span>Total</span>
              <span className="text-primary tabular-nums">{formatCurrency(receipt.total)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Pembayaran</span>
              <span>{receipt.paymentMethod}</span>
            </div>
          </div>

          <Separator />

          {/* Fulfillment */}
          <div className="flex items-start gap-2 text-sm">
            {isOjol ? (
              <Bike size={14} className="text-orange-400 mt-0.5 shrink-0" />
            ) : (
              <ShoppingBag size={14} className="text-blue-400 mt-0.5 shrink-0" />
            )}
            <div>
              <p className="font-semibold">
                {isOjol ? "Ojol Delivery" : "Ambil Sendiri"}
              </p>
              {isOjol && receipt.deliveryAddress && (
                <div className="flex gap-1 mt-1 text-xs text-muted-foreground">
                  <MapPin size={11} className="mt-0.5 shrink-0" />
                  <span>{receipt.deliveryAddress}</span>
                </div>
              )}
              {!isOjol && receipt.storeAddress && (
                <div className="mt-1.5 space-y-1">
                  <div className="flex gap-1 text-xs text-muted-foreground">
                    <MapPin size={11} className="mt-0.5 shrink-0" />
                    <span>{receipt.storeAddress}</span>
                  </div>
                  {receipt.mapsUrl && (
                    <a
                      href={receipt.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      🗺️ Lihat di Google Maps
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {receipt.notes && (
            <div className="text-sm text-muted-foreground bg-secondary/50 rounded-lg px-3 py-2 border border-border/50">
              <span className="font-semibold text-foreground">Catatan: </span>
              {receipt.notes}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-border flex gap-2 bg-secondary/10">
          <Button variant="outline" className="flex-1 border-border" onClick={onClose}>
            Tutup
          </Button>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1"
            onClick={() => setTimeout(onClose, 300)}
          >
            <Button className="w-full bg-[#25D366] hover:bg-[#20b857] text-white font-bold shadow-md shadow-green-900/30">
              <MessageCircle size={15} className="mr-2" />
              Kirim via WA
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}
