import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  db, getOrderItems, voidOrder, updateOrder,
  type Order, type OrderItem,
} from "@/database/db";
import { formatCurrency } from "@/utils/format";
import {
  FileText, Search, Eye, Pencil, Ban, ShoppingBag, Bike,
  User, Phone, Calendar, CreditCard, StickyNote, MapPin,
  MessageSquare, ChevronDown, AlertTriangle,
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
  payment_method: PaymentMethod;
  fulfillment_method: FulfillmentMethod;
  delivery_address: string;
  delivery_notes: string;
  estimated_delivery_fee: number;
  notes: string;
  status: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  pending:     "bg-secondary text-muted-foreground border-border",
  "in-progress": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  ready:       "bg-blue-500/10 text-blue-400 border-blue-500/20",
  delivered:   "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  void:        "bg-destructive/10 text-destructive border-destructive/20",
};

const FULFILLMENT_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  pickup: { label: "Ambil Sendiri", icon: <ShoppingBag size={12} /> },
  ojol:   { label: "Ojol Delivery", icon: <Bike size={12} /> },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function StatusBadge({ order }: { order: Order }) {
  const key = order.is_void ? "void" : order.status;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border ${STATUS_STYLES[key] ?? STATUS_STYLES.pending}`}>
      {key}
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

// ── View Details Modal ─────────────────────────────────────────────────────

function ViewModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const items = useLiveQuery(() => order.id ? getOrderItems(order.id) : [], [order.id]) ?? [];

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-[520px] bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            Order #{order.id}
            <StatusBadge order={order} />
          </DialogTitle>
          <DialogDescription>Created {formatDate(order.created_at)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Customer info */}
          <div className="grid grid-cols-2 gap-3">
            <InfoRow icon={<User size={13} />} label="Customer" value={order.customer_name} />
            {order.customer_phone && (
              <InfoRow icon={<Phone size={13} />} label="Phone" value={order.customer_phone} />
            )}
            <InfoRow icon={<Calendar size={13} />} label="Ready Date" value={formatDate(order.ready_date)} />
            <InfoRow icon={<CreditCard size={13} />} label="Payment" value={order.payment_method} />
          </div>

          {/* Fulfillment */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Fulfillment</p>
            <FulfillmentBadge method={order.fulfillment_method} />
          </div>

          {/* Ojol delivery details */}
          {order.fulfillment_method === "ojol" && (
            <div className="rounded-xl border border-border/60 bg-background/50 p-3 space-y-2">
              {order.delivery_address && (
                <InfoRow icon={<MapPin size={13} />} label="Address" value={order.delivery_address} />
              )}
              {order.delivery_notes && (
                <InfoRow icon={<MessageSquare size={13} />} label="Delivery Notes" value={order.delivery_notes} />
              )}
              <InfoRow
                icon={<Bike size={13} />}
                label="Est. Delivery Fee"
                value={formatCurrency(order.estimated_delivery_fee)}
              />
            </div>
          )}

          {/* Notes */}
          {order.notes && (
            <InfoRow icon={<StickyNote size={13} />} label="Order Notes" value={order.notes} />
          )}

          <Separator />

          {/* Order items */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Items</p>
            <div className="space-y-1.5">
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No items.</p>
              ) : (
                <>
                  <div className="grid grid-cols-[1fr_auto_auto] text-xs text-muted-foreground font-medium px-2 pb-1 uppercase tracking-wider">
                    <span>Product</span>
                    <span className="text-right pr-6">Qty</span>
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

          {/* Total breakdown */}
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Items subtotal</span>
              <span className="tabular-nums">
                {formatCurrency(order.total - (order.fulfillment_method === "ojol" ? order.estimated_delivery_fee : 0))}
              </span>
            </div>
            {order.fulfillment_method === "ojol" && (
              <div className="flex justify-between text-muted-foreground">
                <span>Delivery fee</span>
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
                <Ban size={11} /> This order has been voided and excluded from sales totals.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

// ── Edit Modal ─────────────────────────────────────────────────────────────

function EditModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<EditForm>({
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    ready_date: order.ready_date ? order.ready_date.slice(0, 16) : new Date().toISOString().slice(0, 16),
    payment_method: (order.payment_method as PaymentMethod) ?? "Transfer",
    fulfillment_method: (order.fulfillment_method as FulfillmentMethod) ?? "pickup",
    delivery_address: order.delivery_address ?? "",
    delivery_notes: order.delivery_notes ?? "",
    estimated_delivery_fee: order.estimated_delivery_fee ?? 0,
    notes: order.notes ?? "",
    status: order.status ?? "pending",
  });

  const set = <K extends keyof EditForm>(key: K, val: EditForm[K]) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!order.id) return;
    setIsSaving(true);
    try {
      await updateOrder(order.id, {
        customer_name: form.customer_name || "Walk-in",
        customer_phone: form.customer_phone,
        ready_date: new Date(form.ready_date).toISOString(),
        payment_method: form.payment_method,
        fulfillment_method: form.fulfillment_method,
        delivery_address: form.fulfillment_method === "ojol" ? form.delivery_address : "",
        delivery_notes: form.fulfillment_method === "ojol" ? form.delivery_notes : "",
        estimated_delivery_fee: form.fulfillment_method === "ojol" ? (form.estimated_delivery_fee || 0) : 0,
        notes: form.notes,
        status: form.status,
      });
      toast({ title: "Order updated", description: `Order #${order.id} has been saved.` });
      onClose();
    } catch {
      toast({ title: "Failed to update order", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Edit Order #{order.id}</DialogTitle>
          <DialogDescription>Update order details below.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Customer */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Customer Name</Label>
              <Input className="bg-background border-border h-9 text-sm" placeholder="Walk-in"
                value={form.customer_name} onChange={e => set("customer_name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input className="bg-background border-border h-9 text-sm" placeholder="Optional" type="tel"
                value={form.customer_phone} onChange={e => set("customer_phone", e.target.value)} />
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={form.status} onValueChange={val => set("status", val)}>
              <SelectTrigger className="bg-background border-border h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {["pending", "in-progress", "ready", "delivered"].map(s => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ready date */}
          <div className="space-y-1.5">
            <Label className="text-xs">Ready Date & Time</Label>
            <Input type="datetime-local" className="bg-background border-border h-9 text-sm"
              value={form.ready_date} onChange={e => set("ready_date", e.target.value)} />
          </div>

          {/* Payment */}
          <div className="space-y-1.5">
            <Label className="text-xs">Payment Method</Label>
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

          {/* Fulfillment */}
          <div className="space-y-1.5">
            <Label className="text-xs">Fulfillment Method</Label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => set("fulfillment_method", "pickup")}
                className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
                  form.fulfillment_method === "pickup"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40"
                }`}>
                <ShoppingBag size={14} /> Ambil Sendiri
              </button>
              <button type="button" onClick={() => set("fulfillment_method", "ojol")}
                className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
                  form.fulfillment_method === "ojol"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40"
                }`}>
                <Bike size={14} /> Ojol
              </button>
            </div>
          </div>

          {/* Ojol fields */}
          {form.fulfillment_method === "ojol" && (
            <div className="space-y-3 rounded-xl border border-border/60 bg-background/50 p-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Delivery Address</Label>
                <Textarea className="bg-background border-border text-sm resize-none min-h-[70px]"
                  placeholder="Enter address..." value={form.delivery_address}
                  onChange={e => set("delivery_address", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Delivery Notes</Label>
                <Input className="bg-background border-border h-9 text-sm"
                  placeholder="e.g. Leave at door" value={form.delivery_notes}
                  onChange={e => set("delivery_notes", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Estimated Delivery Fee</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">Rp</span>
                  <Input type="number" min="0" className="bg-background border-border h-9 text-sm pl-9"
                    value={form.estimated_delivery_fee || ""}
                    onChange={e => set("estimated_delivery_fee", parseFloat(e.target.value) || 0)} />
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs">Order Notes</Label>
            <Textarea className="bg-background border-border text-sm resize-none min-h-[60px]"
              placeholder="Special instructions..." value={form.notes}
              onChange={e => set("notes", e.target.value)} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button className="font-bold min-w-[100px]" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function Orders() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [voidTarget, setVoidTarget] = useState<Order | null>(null);

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
      (filter === "ojol" && o.fulfillment_method === "ojol");
    return matchesSearch && matchesFilter;
  });

  const handleVoid = async () => {
    if (!voidTarget?.id) return;
    await voidOrder(voidTarget.id);
    toast({
      title: "Order voided",
      description: `Order #${voidTarget.id} has been voided and excluded from sales totals.`,
    });
    setVoidTarget(null);
  };

  const tabs: { key: FilterTab; label: string; icon: React.ReactNode }[] = [
    { key: "all",    label: "All Orders",    icon: <FileText size={13} /> },
    { key: "pickup", label: "Pickup",         icon: <ShoppingBag size={13} /> },
    { key: "ojol",   label: "Ojol Delivery",  icon: <Bike size={13} /> },
  ];

  const tabCount = (key: FilterTab) =>
    key === "all" ? orders.length :
    key === "pickup" ? orders.filter(o => o.fulfillment_method === "pickup").length :
    orders.filter(o => o.fulfillment_method === "ojol").length;

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Orders</h1>
        <p className="text-muted-foreground mt-1">View, manage, and track all customer orders.</p>
      </div>

      {/* Filter tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        {/* Tabs */}
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

        {/* Search */}
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or order ID..."
            className="pl-9 bg-card border-border"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <Card className="bg-card border-border shadow-xl shadow-black/10 overflow-hidden">
        <Table>
          <TableHeader className="bg-secondary/50">
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="pl-5 w-20">Order #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Ready Date</TableHead>
              <TableHead>Fulfillment</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right pr-5 w-36">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-52 text-center">
                  <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    <FileText className="h-12 w-12 opacity-15" />
                    <div>
                      <p className="font-medium">No orders found</p>
                      <p className="text-sm mt-1">
                        {search ? "Try a different search term." : "Orders will appear here once created."}
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
                />
              ))
            )}
          </TableBody>
        </Table>

        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
            <span>{filtered.length} order{filtered.length !== 1 ? "s" : ""} shown</span>
            <span>
              {filtered.filter(o => o.is_void).length} voided
            </span>
          </div>
        )}
      </Card>

      {/* Modals */}
      {viewOrder && <ViewModal order={viewOrder} onClose={() => setViewOrder(null)} />}
      {editOrder && <EditModal order={editOrder} onClose={() => setEditOrder(null)} />}

      {/* Void Confirmation */}
      <AlertDialog open={!!voidTarget} onOpenChange={open => !open && setVoidTarget(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-destructive" />
              Void Order #{voidTarget?.id}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the order for{" "}
              <span className="font-semibold text-foreground">{voidTarget?.customer_name}</span> as void.
              The order will remain in the database but will be{" "}
              <span className="font-semibold text-destructive">excluded from all sales totals</span>.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-background border-border hover:bg-secondary">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold"
              onClick={handleVoid}
            >
              <Ban size={14} className="mr-1.5" /> Void Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Order Table Row ────────────────────────────────────────────────────────

function OrderTableRow({
  order, onView, onEdit, onVoid,
}: {
  order: Order;
  onView: () => void;
  onEdit: () => void;
  onVoid: () => void;
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
          order.is_void
            ? "opacity-50 bg-destructive/5"
            : "hover:bg-secondary/20"
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
          {formatDate(order.ready_date)}
        </TableCell>

        <TableCell>
          <FulfillmentBadge method={order.fulfillment_method} />
        </TableCell>

        <TableCell className="text-sm text-muted-foreground">
          {order.payment_method}
        </TableCell>

        <TableCell>
          <StatusBadge order={order} />
        </TableCell>

        <TableCell className="text-right">
          <span className={`font-bold tabular-nums text-sm ${order.is_void ? "line-through text-muted-foreground" : ""}`}>
            {formatCurrency(order.total)}
          </span>
        </TableCell>

        <TableCell className="pr-5">
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="View details" onClick={onView}>
              <Eye size={14} />
            </Button>
            <Button
              variant="ghost" size="icon"
              className={`h-8 w-8 ${order.is_void ? "opacity-30 cursor-not-allowed" : "text-muted-foreground hover:text-blue-400 hover:bg-blue-400/10"}`}
              title={order.is_void ? "Cannot edit a voided order" : "Edit order"}
              onClick={onEdit}
              disabled={order.is_void}
            >
              <Pencil size={14} />
            </Button>
            <Button
              variant="ghost" size="icon"
              className={`h-8 w-8 ${order.is_void ? "opacity-30 cursor-not-allowed" : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"}`}
              title={order.is_void ? "Already voided" : "Void order"}
              onClick={onVoid}
              disabled={order.is_void}
            >
              <Ban size={14} />
            </Button>
            <button
              className="h-8 w-8 flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              onClick={() => setExpanded(p => !p)}
              title="Show items"
            >
              <ChevronDown size={14} className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
            </button>
          </div>
        </TableCell>
      </TableRow>

      {/* Expandable items row */}
      {expanded && (
        <TableRow className="border-border/30 bg-secondary/10">
          <TableCell colSpan={8} className="py-3 px-8">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Order Items
              </p>
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground">No items recorded.</p>
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
                  <span className="font-semibold">Notes:</span> {order.notes}
                </p>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
