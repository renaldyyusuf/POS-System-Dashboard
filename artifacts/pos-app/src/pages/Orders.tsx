import { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  db, getOrderItems, voidOrder, updateOrder, replaceOrderItems, requeueOrderSync,
  type Order, type OrderItem,
} from "@/database/db";
import { getGasUrl, syncPendingOrders } from "@/services/syncService";
import { getPendingSyncCount } from "@/database/db";
import { formatCurrency, formatDateTime } from "@/utils/format";
import { ReceiptModal, type ReceiptData } from "@/components/ReceiptModal";
import {
  FileText, Search, Eye, Pencil, Ban, ShoppingBag, Bike,
  User, Phone, Calendar, CreditCard, StickyNote, MapPin,
  MessageSquare, ChevronDown, AlertTriangle, Plus, Minus, Trash2, Package, ShoppingCart,
  RefreshCw, CloudOff, MessageCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

// ── Types ──────────────────────────────────────────────────────────────────

type FilterTab = "all" | "pickup" | "ojol";
type PaymentMethod = "Transfer" | "QRIS";
type FulfillmentMethod = "pickup" | "ojol";

interface EditForm {
  customer_name: string;
  customer_phone: string;
  ready_date: string;
  payment_method: string;
  fulfillment_method: FulfillmentMethod;
  delivery_address: string;
  delivery_notes: string;
  estimated_delivery_fee: number;
  notes: string;
  status: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  pending:       "bg-secondary text-muted-foreground border-border",
  "in-progress": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  ready:         "bg-blue-500/10 text-blue-400 border-blue-500/20",
  delivered:     "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  void:          "bg-destructive/10 text-destructive border-destructive/20",
};

const STATUS_LABELS: Record<string, string> = {
  pending:       "Menunggu",
  "in-progress": "Diproses",
  ready:         "Siap",
  delivered:     "Selesai",
  void:          "Dibatalkan",
};

const FULFILLMENT_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  pickup: { label: "Ambil Sendiri", icon: <ShoppingBag size={12} /> },
  ojol:   { label: "Diantar (Ojol)", icon: <Bike size={12} /> },
};

function StatusBadge({ order }: { order: Order }) {
  const key = order.is_void ? "void" : order.status;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border ${STATUS_STYLES[key] ?? STATUS_STYLES.pending}`}>
      {STATUS_LABELS[key] ?? key}
    </span>
  );
}

function FulfillmentBadge({ method }: { method: string }) {
  const info = FULFILLMENT_LABELS[method] ?? { label: method, icon: null };
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-muted-foreground border border-border">
      {info.icon} {info.label}
    </span>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground flex items-center gap-1 mb-0.5">{icon} {label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

// ── View Modal ─────────────────────────────────────────────────────────────

function ViewModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const items = useLiveQuery(() => order.id ? getOrderItems(order.id) : [], [order.id]) ?? [];

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-[520px] bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            Pesanan #{order.id}
            <StatusBadge order={order} />
          </DialogTitle>
          <DialogDescription>Dibuat {formatDateTime(order.created_at)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <InfoRow icon={<User size={13} />}     label="Pelanggan"      value={order.customer_name} />
            {order.customer_phone && (
              <InfoRow icon={<Phone size={13} />}  label="No. Telepon"    value={order.customer_phone} />
            )}
            <InfoRow icon={<Calendar size={13} />} label="Tanggal Siap"   value={formatDateTime(order.ready_date)} />
            <InfoRow icon={<CreditCard size={13} />} label="Pembayaran"   value={order.payment_method} />
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Metode Pengambilan</p>
            <FulfillmentBadge method={order.fulfillment_method} />
          </div>

          {order.fulfillment_method === "ojol" && (
            <div className="rounded-xl border border-border/60 bg-background/50 p-3 space-y-2">
              {order.delivery_address && (
                <InfoRow icon={<MapPin size={13} />}        label="Alamat Pengiriman"  value={order.delivery_address} />
              )}
              {order.delivery_notes && (
                <InfoRow icon={<MessageSquare size={13} />} label="Catatan Pengiriman" value={order.delivery_notes} />
              )}
              <InfoRow
                icon={<Bike size={13} />}
                label="Est. Ongkos Kirim"
                value={formatCurrency(order.estimated_delivery_fee)}
              />
            </div>
          )}

          {order.notes && (
            <InfoRow icon={<StickyNote size={13} />} label="Catatan Pesanan" value={order.notes} />
          )}

          <Separator />

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Item Pesanan</p>
            <div className="space-y-1.5">
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada item.</p>
              ) : (
                <>
                  <div className="grid grid-cols-[1fr_auto_auto] text-xs text-muted-foreground font-medium px-2 pb-1 uppercase tracking-wider">
                    <span>Produk</span>
                    <span className="text-right pr-6">Jml</span>
                    <span className="text-right">Subtotal</span>
                  </div>
                  {items.map((item, i) => (
                    <div key={i} className="grid grid-cols-[1fr_auto_auto] items-center bg-background/50 rounded-lg px-3 py-2 border border-border/40 text-sm">
                      <span className="font-medium">{item.product_name}</span>
                      <span className="text-muted-foreground text-right pr-6 tabular-nums">×{item.qty}</span>
                      <span className="font-bold text-primary tabular-nums">{formatCurrency(item.subtotal)}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">
                {formatCurrency(order.total - (order.fulfillment_method === "ojol" ? order.estimated_delivery_fee : 0))}
              </span>
            </div>
            {order.fulfillment_method === "ojol" && (
              <div className="flex justify-between text-muted-foreground">
                <span>Ongkos kirim</span>
                <span className="tabular-nums">{formatCurrency(order.estimated_delivery_fee)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t border-border pt-2">
              <span>Total</span>
              <span className={`tabular-nums ${order.is_void ? "line-through text-muted-foreground" : "text-primary"}`}>
                {formatCurrency(order.total)}
              </span>
            </div>
            {order.is_void && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <Ban size={11} /> Pesanan ini telah dibatalkan dan tidak dihitung dalam total penjualan.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Modal ─────────────────────────────────────────────────────────────

// Convert phone number to Indonesian format (+62...)
function toIndonesianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("62")) return digits;         // already +62
  if (digits.startsWith("0")) return "62" + digits.slice(1); // 08xx → 628xx
  return "62" + digits;                               // fallback
}

// Convert UTC ISO string → "YYYY-MM-DDTHH:mm" in local timezone (for datetime-local input)
function toLocalDatetimeInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Local type for editable items
interface EditableItem {
  product_name: string;
  price: number;
  qty: number;
}

function EditModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"detail" | "items">("detail");

  // ── Detail form ──────────────────────────────────────────────────────────
  const [form, setForm] = useState<EditForm>({
    customer_name:          order.customer_name,
    customer_phone:         order.customer_phone,
    ready_date:             order.ready_date ? toLocalDatetimeInput(order.ready_date) : toLocalDatetimeInput(new Date().toISOString()),
    payment_method:         order.payment_method ?? "Transfer",
    fulfillment_method:     (order.fulfillment_method as FulfillmentMethod) ?? "pickup",
    delivery_address:       order.delivery_address ?? "",
    delivery_notes:         order.delivery_notes ?? "",
    estimated_delivery_fee: order.estimated_delivery_fee ?? 0,
    notes:                  order.notes ?? "",
    status:                 order.status ?? "pending",
  });
  const set = <K extends keyof EditForm>(key: K, val: EditForm[K]) =>
    setForm(prev => ({ ...prev, [key]: val }));

  // ── Item editor ──────────────────────────────────────────────────────────
  const [editItems, setEditItems] = useState<EditableItem[] | null>(null);
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [showAddProduct, setShowAddProduct] = useState(false);

  const allProducts = useLiveQuery(() => db.products.orderBy("name").toArray()) ?? [];

  const loadItems = async () => {
    if (itemsLoaded) return;
    const raw = await getOrderItems(order.id!);
    setEditItems(raw.map(i => ({ product_name: i.product_name, price: i.price, qty: i.qty })));
    setItemsLoaded(true);
  };

  const handleTabChange = (tab: "detail" | "items") => {
    setActiveTab(tab);
    if (tab === "items") loadItems();
  };

  const updateItemQty = (idx: number, delta: number) => {
    setEditItems(prev => {
      if (!prev) return prev;
      const next = [...prev];
      const newQty = next[idx].qty + delta;
      if (newQty <= 0) { next.splice(idx, 1); } else { next[idx] = { ...next[idx], qty: newQty }; }
      return next;
    });
  };

  const setItemQty = (idx: number, val: string) => {
    const n = parseInt(val, 10);
    setEditItems(prev => {
      if (!prev) return prev;
      const next = [...prev];
      if (!val || n <= 0) {
        // keep field editable, just store 1 as minimum when blurred
        next[idx] = { ...next[idx], qty: isNaN(n) ? 1 : Math.max(1, n) };
      } else {
        next[idx] = { ...next[idx], qty: n };
      }
      return next;
    });
  };


  const removeItem = (idx: number) =>
    setEditItems(prev => prev ? prev.filter((_, i) => i !== idx) : prev);

  const addProduct = (p: { name: string; price: number }) => {
    setEditItems(prev => {
      if (!prev) return prev;
      const existing = prev.findIndex(i => i.product_name === p.name);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { ...next[existing], qty: next[existing].qty + 1 };
        return next;
      }
      return [...prev, { product_name: p.name, price: p.price, qty: 1 }];
    });
    setAddSearch("");
    setShowAddProduct(false);
  };

  const filteredAddProducts = allProducts.filter(p =>
    p.name.toLowerCase().includes(addSearch.toLowerCase()) ||
    (p.portion_size ?? "").toLowerCase().includes(addSearch.toLowerCase())
  );

  const itemsTotal = (editItems ?? []).reduce((s, i) => s + i.price * i.qty, 0);
  const deliveryFee = form.fulfillment_method === "ojol" ? (form.estimated_delivery_fee || 0) : 0;
  const grandTotal = itemsTotal + deliveryFee;

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!order.id) return;
    if (editItems !== null && editItems.length === 0) {
      toast({ title: "Pesanan kosong", description: "Tambahkan minimal satu item.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      await updateOrder(order.id, {
        customer_name:          form.customer_name || "Tanpa Nama",
        customer_phone:         form.customer_phone,
        ready_date:             new Date(form.ready_date).toISOString(),
        payment_method:         form.payment_method,
        fulfillment_method:     form.fulfillment_method,
        delivery_address:       form.fulfillment_method === "ojol" ? form.delivery_address : "",
        delivery_notes:         form.fulfillment_method === "ojol" ? form.delivery_notes : "",
        estimated_delivery_fee: form.fulfillment_method === "ojol" ? (form.estimated_delivery_fee || 0) : 0,
        notes:                  form.notes,
        status:                 form.status,
        ...(editItems !== null ? { total: grandTotal } : {}),
      });

      if (editItems !== null) {
        const newItems = editItems.map(i => ({
          order_id:     order.id!,
          product_name: i.product_name,
          qty:          i.qty,
          price:        i.price,
          subtotal:     i.price * i.qty,
        }));
        await replaceOrderItems(order.id, newItems);
      }

      await requeueOrderSync(order.id);

      const gasUrl = getGasUrl();
      if (gasUrl) syncPendingOrders(gasUrl).catch(() => {});

      toast({
        title: "Pesanan diperbarui",
        description: `Pesanan #${order.id} disimpan${gasUrl ? " & disinkronkan." : "."}`,
      });
      onClose();
    } catch {
      toast({ title: "Gagal memperbarui pesanan", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-[540px] bg-card border-border max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">

        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
          <DialogTitle className="text-xl font-bold">Edit Pesanan #{order.id}</DialogTitle>
          <DialogDescription>Perbarui detail atau ubah item pesanan.</DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 px-5 shrink-0 border-b border-border">
          {([["detail", "📋 Detail"], ["items", "🛒 Item Pesanan"]] as const).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all ${
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* ── Tab: Detail ── */}
          {activeTab === "detail" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nama Pelanggan</Label>
                  <Input className="bg-background border-border h-9 text-sm" placeholder="Tanpa Nama"
                    value={form.customer_name} onChange={e => set("customer_name", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">No. Telepon</Label>
                  <Input className="bg-background border-border h-9 text-sm" placeholder="Opsional" type="tel"
                    value={form.customer_phone} onChange={e => set("customer_phone", e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={val => set("status", val)}>
                  <SelectTrigger className="bg-background border-border h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {[
                      { value: "pending",     label: "Menunggu" },
                      { value: "in-progress", label: "Diproses" },
                      { value: "ready",       label: "Siap" },
                      { value: "delivered",   label: "Selesai" },
                    ].map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Tanggal &amp; Waktu Siap</Label>
                <Input type="datetime-local" className="bg-background border-border h-9 text-sm"
                  value={form.ready_date} onChange={e => set("ready_date", e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Metode Pembayaran</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["Transfer", "QRIS"] as PaymentMethod[]).map(m => (
                    <button key={m} type="button" onClick={() => set("payment_method", m)}
                      className={`py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
                        form.payment_method === m
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40"
                      }`}>
                      {m === "Transfer" ? "💳 Transfer" : "📱 QRIS"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Metode Pengambilan</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => set("fulfillment_method", "pickup")}
                    className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
                      form.fulfillment_method === "pickup" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/40"
                    }`}>
                    <ShoppingBag size={14} /> Ambil Sendiri
                  </button>
                  <button type="button" onClick={() => set("fulfillment_method", "ojol")}
                    className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
                      form.fulfillment_method === "ojol" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/40"
                    }`}>
                    <Bike size={14} /> Diantar (Ojol)
                  </button>
                </div>
              </div>

              {form.fulfillment_method === "ojol" && (
                <div className="space-y-3 rounded-xl border border-border/60 bg-background/50 p-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Alamat Pengiriman</Label>
                    <Textarea className="bg-background border-border text-sm resize-none min-h-[70px]"
                      placeholder="Masukkan alamat..." value={form.delivery_address}
                      onChange={e => set("delivery_address", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Catatan Pengiriman</Label>
                    <Input className="bg-background border-border h-9 text-sm"
                      placeholder="cth. Taruh di depan pintu" value={form.delivery_notes}
                      onChange={e => set("delivery_notes", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Est. Ongkos Kirim</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">Rp</span>
                      <Input type="number" min="0" className="bg-background border-border h-9 text-sm pl-9"
                        value={form.estimated_delivery_fee || ""}
                        onChange={e => set("estimated_delivery_fee", parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Catatan Pesanan</Label>
                <Textarea className="bg-background border-border text-sm resize-none min-h-[60px]"
                  placeholder="Instruksi khusus..." value={form.notes}
                  onChange={e => set("notes", e.target.value)} />
              </div>
            </div>
          )}

          {/* ── Tab: Item Pesanan ── */}
          {activeTab === "items" && (
            <div className="space-y-3">
              {!itemsLoaded ? (
                <div className="py-8 flex items-center justify-center text-muted-foreground text-sm gap-2">
                  <Package size={16} className="animate-pulse" /> Memuat item...
                </div>
              ) : (
                <>
                  {(editItems ?? []).length === 0 ? (
                    <div className="py-6 flex flex-col items-center gap-2 text-muted-foreground/50">
                      <ShoppingCart size={28} strokeWidth={1.2} />
                      <p className="text-sm">Belum ada item</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {(editItems ?? []).map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-background/60 border border-border/50 rounded-xl px-3 py-2.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.product_name}</p>
                            <p className="text-xs text-muted-foreground tabular-nums">{formatCurrency(item.price)} / porsi</p>
                          </div>
                          <div className="flex items-center gap-0.5 bg-secondary rounded-lg p-0.5 shrink-0">
                            <button onClick={() => updateItemQty(idx, -1)}
                              className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors">
                              <Minus size={12} />
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={item.qty}
                              onChange={e => setItemQty(idx, e.target.value)}
                              onBlur={e => { if (!e.target.value || parseInt(e.target.value) < 1) setItemQty(idx, "1"); }}
                              className="w-10 text-center text-sm font-bold tabular-nums bg-transparent border-none outline-none focus:ring-1 focus:ring-primary/40 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button onClick={() => updateItemQty(idx, +1)}
                              className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors">
                              <Plus size={12} />
                            </button>
                          </div>
                          <span className="text-sm font-bold tabular-nums w-24 text-right shrink-0">
                            {formatCurrency(item.price * item.qty)}
                          </span>
                          <button onClick={() => removeItem(idx)}
                            className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {(editItems ?? []).length > 0 && (
                    <div className="rounded-xl border border-border/40 bg-secondary/20 px-4 py-3 space-y-1.5 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal item</span>
                        <span className="tabular-nums">{formatCurrency(itemsTotal)}</span>
                      </div>
                      {deliveryFee > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Ongkos Kirim</span>
                          <span className="tabular-nums">{formatCurrency(deliveryFee)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-base border-t border-border/40 pt-1.5">
                        <span>Total</span>
                        <span className="text-primary tabular-nums">{formatCurrency(grandTotal)}</span>
                      </div>
                    </div>
                  )}

                  <Separator />

                  <div className="space-y-2">
                    <button
                      onClick={() => setShowAddProduct(p => !p)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 text-sm font-semibold text-muted-foreground hover:text-primary transition-all"
                    >
                      <Plus size={15} /> Tambah Produk
                    </button>

                    {showAddProduct && (
                      <div className="space-y-2 rounded-xl border border-border bg-background/50 p-3 animate-in fade-in slide-in-from-top-2 duration-150">
                        <Input autoFocus className="bg-background border-border h-9 text-sm"
                          placeholder="Cari produk..." value={addSearch}
                          onChange={e => setAddSearch(e.target.value)} />
                        <div className="max-h-44 overflow-y-auto space-y-0.5">
                          {filteredAddProducts.length === 0 ? (
                            <p className="text-xs text-muted-foreground/50 text-center py-3">Produk tidak ditemukan</p>
                          ) : filteredAddProducts.map(p => (
                            <button key={p.id} onClick={() => addProduct({ name: p.name, price: p.price })}
                              className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-primary/10 text-sm transition-colors group">
                              <div className="text-left">
                                <p className="font-medium group-hover:text-primary transition-colors">{p.name}</p>
                                <p className="text-xs text-muted-foreground">{p.portion_size}</p>
                              </div>
                              <span className="font-bold text-primary tabular-nums shrink-0">{formatCurrency(p.price)}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border shrink-0 flex gap-2 bg-secondary/10">
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button className="flex-1 font-bold" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Menyimpan..." : "💾 Simpan & Sinkronkan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

// ── Order Receipt Modal ────────────────────────────────────────────────────

function OrderReceiptModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const items = useLiveQuery(() => order.id ? getOrderItems(order.id) : [], [order.id]) ?? [];
  const storeSettings = useLiveQuery(() => db.store_settings.toCollection().first());

  const receipt: ReceiptData = {
    orderId:           order.id!,
    orderDate:         order.created_at,
    readyDate:         order.ready_date || order.created_at,
    customerName:      order.customer_name,
    customerPhone:     toIndonesianPhone(order.customer_phone ?? ""),
    paymentMethod:     order.payment_method,
    fulfillmentMethod: (order.fulfillment_method as "pickup" | "ojol") ?? "pickup",
    deliveryAddress:   order.delivery_address ?? "",
    deliveryFee:       order.estimated_delivery_fee ?? 0,
    notes:             order.notes ?? "",
    items:             items.map(i => ({
      product_name: i.product_name,
      qty:          i.qty,
      price:        i.price,
      subtotal:     i.subtotal,
    })),
    total:        order.total,
    storeName:    storeSettings?.store_name,
    storeAddress: storeSettings?.store_address,
    mapsUrl:      storeSettings?.maps_url,
  };

  return <ReceiptModal receipt={receipt} onClose={onClose} />;
}

export default function Orders() {
  const { toast } = useToast();
  const [search, setSearch]       = useState("");
  const [filter, setFilter]       = useState<FilterTab>("all");
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [voidTarget, setVoidTarget]   = useState<Order | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [isSyncing, setIsSyncing]     = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline]         = useState(navigator.onLine);

  useEffect(() => {
    getPendingSyncCount().then(setPendingCount);
    const onOnline  = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online",  onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online",  onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const orders = useLiveQuery(() =>
    db.orders.orderBy("created_at").reverse().toArray()
  ) ?? [];

  const filtered = orders.filter(o => {
    const matchesSearch =
      o.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      String(o.id).includes(search);
    const matchesFilter =
      filter === "all" ||
      (filter === "pickup" && o.fulfillment_method === "pickup") ||
      (filter === "ojol"   && o.fulfillment_method === "ojol");
    return matchesSearch && matchesFilter;
  });

  const handleSync = async () => {
    const url = getGasUrl();
    if (!url) {
      toast({ title: "URL belum dikonfigurasi", description: "Atur Google Sheets di Pengaturan Toko.", variant: "destructive" });
      return;
    }
    if (!isOnline) {
      toast({ title: "Tidak ada koneksi internet", variant: "destructive" });
      return;
    }
    setIsSyncing(true);
    try {
      const result = await syncPendingOrders(url);
      const newCount = await getPendingSyncCount();
      setPendingCount(newCount);
      toast({
        title: result.synced > 0 ? "Sinkronisasi selesai" : "Tidak ada yang perlu disinkronkan",
        description: result.synced > 0
          ? `${result.synced} pesanan berhasil disinkronkan.`
          : result.failed > 0 ? `${result.failed} pesanan gagal — periksa URL endpoint.`
          : "Semua pesanan sudah tersinkronisasi.",
      });
    } catch {
      toast({ title: "Sinkronisasi gagal", variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleVoid = async () => {
    if (!voidTarget?.id) return;
    await voidOrder(voidTarget.id);
    toast({
      title: "Pesanan dibatalkan",
      description: `Pesanan #${voidTarget.id} telah dibatalkan dan tidak dihitung dalam total penjualan.`,
    });
    setVoidTarget(null);
  };

  const tabs: { key: FilterTab; label: string; icon: React.ReactNode }[] = [
    { key: "all",    label: "Semua Pesanan", icon: <FileText size={13} /> },
    { key: "pickup", label: "Ambil Sendiri", icon: <ShoppingBag size={13} /> },
    { key: "ojol",   label: "Diantar (Ojol)", icon: <Bike size={13} /> },
  ];

  const tabCount = (key: FilterTab) =>
    key === "all"    ? orders.length :
    key === "pickup" ? orders.filter(o => o.fulfillment_method === "pickup").length :
    orders.filter(o => o.fulfillment_method === "ojol").length;

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Pesanan</h1>
          <p className="text-muted-foreground mt-1">Lihat, kelola, dan pantau semua pesanan pelanggan.</p>
        </div>
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
            pendingCount > 0
              ? "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
              : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
          } disabled:opacity-50`}
        >
          {isSyncing
            ? <RefreshCw size={14} className="animate-spin" />
            : <RefreshCw size={14} />
          }
          {pendingCount > 0 && (
            <span className="flex items-center gap-1">
              <CloudOff size={13} />
              {pendingCount}
            </span>
          )}
          {isSyncing ? "Menyinkronkan..." : "Sinkronkan"}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center bg-secondary/60 rounded-xl p-1 gap-0.5 border border-border">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                filter === tab.key
                  ? "bg-card text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                filter === tab.key ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
              }`}>
                {tabCount(tab.key)}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama atau no. pesanan..."
            className="pl-9 bg-card border-border"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card className="bg-card border-border shadow-xl shadow-black/10 overflow-hidden">
        <Table>
          <TableHeader className="bg-secondary/50">
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="pl-5 w-20">No.</TableHead>
              <TableHead>Pelanggan</TableHead>
              <TableHead>Tanggal Siap</TableHead>
              <TableHead>Pengambilan</TableHead>
              <TableHead>Pembayaran</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right pr-5 w-36">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-52 text-center">
                  <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    <FileText className="h-12 w-12 opacity-15" />
                    <div>
                      <p className="font-medium">Pesanan tidak ditemukan</p>
                      <p className="text-sm mt-1">
                        {search
                          ? "Coba kata kunci lain."
                          : "Pesanan akan muncul setelah dibuat."}
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(order => (
                <OrderTableRow
                  key={order.id}
                  order={order}
                  onView={() => setViewOrder(order)}
                  onEdit={() => !order.is_void && setEditOrder(order)}
                  onVoid={() => !order.is_void && setVoidTarget(order)}
                  onWhatsApp={() => !order.is_void && setReceiptOrder(order)}
                />
              ))
            )}
          </TableBody>
        </Table>

        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
            <span>{filtered.length} pesanan ditampilkan</span>
            <span>{filtered.filter(o => o.is_void).length} dibatalkan</span>
          </div>
        )}
      </Card>

      {viewOrder    && <ViewModal order={viewOrder}    onClose={() => setViewOrder(null)} />}
      {editOrder    && <EditModal order={editOrder}    onClose={() => setEditOrder(null)} />}
      {receiptOrder && <OrderReceiptModal order={receiptOrder} onClose={() => setReceiptOrder(null)} />}

      <AlertDialog open={!!voidTarget} onOpenChange={open => !open && setVoidTarget(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-destructive" />
              Batalkan Pesanan #{voidTarget?.id}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Pesanan atas nama{" "}
              <span className="font-semibold text-foreground">{voidTarget?.customer_name}</span> akan dibatalkan.
              Data akan tetap tersimpan namun{" "}
              <span className="font-semibold text-destructive">tidak dihitung dalam total penjualan</span>.
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-background border-border hover:bg-secondary">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold"
              onClick={handleVoid}
            >
              <Ban size={14} className="mr-1.5" /> Batalkan Pesanan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Order Table Row ────────────────────────────────────────────────────────

function OrderTableRow({
  order, onView, onEdit, onVoid, onWhatsApp,
}: {
  order: Order;
  onView: () => void;
  onEdit: () => void;
  onVoid: () => void;
  onWhatsApp: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const items = useLiveQuery<OrderItem[]>(
    () => expanded && order.id ? getOrderItems(order.id) : Promise.resolve([]),
    [expanded, order.id]
  ) ?? [];

  return (
    <>
      <TableRow
        className={`border-border/50 transition-colors ${
          order.is_void ? "opacity-50 bg-destructive/5" : "hover:bg-secondary/20"
        }`}
      >
        <TableCell className="pl-5">
          <span className="font-mono text-sm font-bold text-primary/90">#{order.id}</span>
        </TableCell>

        <TableCell>
          <div className="flex items-center gap-1.5">
            <User size={12} className="text-muted-foreground shrink-0" />
            <span className="font-medium text-sm">{order.customer_name}</span>
          </div>
          {order.customer_phone && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <Phone size={11} className="text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">{order.customer_phone}</span>
            </div>
          )}
        </TableCell>

        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
          {formatDateTime(order.ready_date)}
        </TableCell>

        <TableCell><FulfillmentBadge method={order.fulfillment_method} /></TableCell>

        <TableCell className="text-sm text-muted-foreground">{order.payment_method}</TableCell>

        <TableCell><StatusBadge order={order} /></TableCell>

        <TableCell className="text-right">
          <span className={`font-bold tabular-nums text-sm ${order.is_void ? "line-through text-muted-foreground" : ""}`}>
            {formatCurrency(order.total)}
          </span>
        </TableCell>

        <TableCell className="pr-5">
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Lihat detail" onClick={onView}>
              <Eye size={14} />
            </Button>
            <Button
              variant="ghost" size="icon"
              className={`h-8 w-8 ${order.is_void ? "opacity-30 cursor-not-allowed" : "text-muted-foreground hover:text-blue-400 hover:bg-blue-400/10"}`}
              title={order.is_void ? "Tidak dapat mengedit pesanan yang dibatalkan" : "Edit pesanan"}
              onClick={onEdit}
              disabled={order.is_void}
            >
              <Pencil size={14} />
            </Button>
            <Button
              variant="ghost" size="icon"
              className={`h-8 w-8 ${order.is_void ? "opacity-30 cursor-not-allowed" : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"}`}
              title={order.is_void ? "Sudah dibatalkan" : "Batalkan pesanan"}
              onClick={onVoid}
              disabled={order.is_void}
            >
              <Ban size={14} />
            </Button>
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-[#25D366] hover:bg-[#25D366]/10"
              title="Kirim struk via WhatsApp"
              onClick={onWhatsApp}
              disabled={order.is_void}
            >
              <MessageCircle size={14} />
            </Button>
            <button
              className="h-8 w-8 flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              onClick={() => setExpanded(p => !p)}
              title="Tampilkan item"
            >
              <ChevronDown size={14} className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
            </button>
          </div>
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow className="border-border/30 bg-secondary/10">
          <TableCell colSpan={8} className="py-3 px-8">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Item Pesanan
              </p>
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground">Belum ada item tercatat.</p>
              ) : (
                items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>
                      <span className="font-semibold text-muted-foreground">{item.qty}×</span>{" "}
                      {item.product_name}
                    </span>
                    <span className="text-primary font-medium tabular-nums">
                      {formatCurrency(item.subtotal)}
                    </span>
                  </div>
                ))
              )}
              {order.notes && (
                <p className="text-xs text-muted-foreground pt-2 border-t border-border/40 mt-2">
                  <span className="font-semibold">Catatan:</span> {order.notes}
                </p>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
