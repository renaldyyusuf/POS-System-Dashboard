import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  db, createOrder, saveOrderItems, addToSyncQueue,
  getPendingSyncCount, type Product,
} from "@/database/db";
import { useCart, type CartItem } from "@/hooks/useCart";
import { formatCurrency } from "@/utils/format";
import {
  Search, Trash2, ShoppingCart, Package, Plus, Minus, X,
  Bike, ShoppingBag, Save, AlertCircle, RefreshCw, Settings2,
  Wifi, WifiOff, CloudOff,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ReceiptModal, type ReceiptData } from "@/components/ReceiptModal";
import {
  getGasUrl, setGasUrl, syncPendingOrders, startAutoSync, testGasConnection,
} from "@/services/syncService";

// ── Types ──────────────────────────────────────────────────────────────────

type PaymentMethod = "Transfer" | "QRIS";
type FulfillmentMethod = "pickup" | "ojol";

interface OrderForm {
  customer_name: string;
  customer_phone: string;
  ready_date: string;
  payment_method: PaymentMethod;
  notes: string;
  fulfillment_method: FulfillmentMethod;
  delivery_address: string;
  delivery_notes: string;
  estimated_delivery_fee: number;
}

const defaultForm = (): OrderForm => ({
  customer_name: "",
  customer_phone: "",
  ready_date: new Date().toISOString().slice(0, 16),
  payment_method: "Transfer",
  notes: "",
  fulfillment_method: "pickup",
  delivery_address: "",
  delivery_notes: "",
  estimated_delivery_fee: 0,
});

// ── Component ──────────────────────────────────────────────────────────────

export default function Cashier() {
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [qtyInput, setQtyInput] = useState(1);
  const [form, setForm] = useState<OrderForm>(defaultForm());
  const [isSaving, setIsSaving] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  // Google Sheets sync state
  const [gasUrl, setGasUrlState] = useState(getGasUrl());
  const [showSyncSettings, setShowSyncSettings] = useState(false);
  const [syncUrlInput, setSyncUrlInput] = useState(getGasUrl());
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");

  const { toast } = useToast();
  const cart = useCart();

  const products = useLiveQuery(() => db.products.toArray(), []) || [];

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.portion_size.toLowerCase().includes(search.toLowerCase())
  );

  const grandTotal = cart.getTotal() +
    (form.fulfillment_method === "ojol" ? (form.estimated_delivery_fee || 0) : 0);

  // ── Lifecycle ──────────────────────────────────────────────────────────

  useEffect(() => {
    // Start auto-sync and track online status
    const cleanup = startAutoSync();
    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Refresh pending count on mount
    getPendingSyncCount().then(setPendingCount);

    return () => {
      cleanup();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setQtyInput(1);
  };

  const handleAddToCart = () => {
    if (!selectedProduct) return;
    cart.addItem(selectedProduct as any, qtyInput);
    setSelectedProduct(null);
    toast({ title: "Added to cart", description: `${qtyInput}× ${selectedProduct.name}` });
  };

  const handleSaveOrder = async () => {
    if (cart.items.length === 0) {
      toast({ title: "Cart is empty", description: "Add products before saving.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const readyIso = form.ready_date
        ? new Date(form.ready_date).toISOString()
        : now;

      const orderId = await createOrder({
        customer_name: form.customer_name || "Walk-in",
        customer_phone: form.customer_phone,
        ready_date: readyIso,
        payment_method: form.payment_method,
        total: grandTotal,
        status: "pending",
        fulfillment_method: form.fulfillment_method,
        delivery_address: form.fulfillment_method === "ojol" ? form.delivery_address : "",
        delivery_notes: form.fulfillment_method === "ojol" ? form.delivery_notes : "",
        estimated_delivery_fee: form.fulfillment_method === "ojol" ? (form.estimated_delivery_fee || 0) : 0,
        notes: form.notes,
      });

      const orderItems = cart.items.map((item: CartItem) => ({
        order_id: orderId,
        product_name: item.product_name,
        qty: item.qty,
        price: item.price,
        subtotal: item.price * item.qty,
      }));

      await saveOrderItems(orderItems);

      // ── Enqueue for Google Sheets sync ──────────────────────────────
      await addToSyncQueue(orderId);
      const newCount = await getPendingSyncCount();
      setPendingCount(newCount);

      // Try to sync immediately if online and URL is configured
      if (navigator.onLine && gasUrl) {
        syncPendingOrders(gasUrl)
          .then(async result => {
            if (result.synced > 0) {
              const c = await getPendingSyncCount();
              setPendingCount(c);
            }
          })
          .catch(() => {});
      }

      // ── Show receipt modal ──────────────────────────────────────────
      setReceipt({
        orderId,
        orderDate: now,
        readyDate: readyIso,
        customerName: form.customer_name || "Walk-in",
        customerPhone: form.customer_phone,
        paymentMethod: form.payment_method,
        fulfillmentMethod: form.fulfillment_method,
        deliveryAddress: form.delivery_address,
        deliveryFee: form.estimated_delivery_fee || 0,
        notes: form.notes,
        items: orderItems,
        total: grandTotal,
      });

      cart.clearCart();
      setForm(defaultForm());
    } catch {
      toast({ title: "Failed to save order", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualSync = async () => {
    if (!gasUrl) { setShowSyncSettings(true); return; }
    if (!isOnline) {
      toast({ title: "No internet", description: "Connect to the internet and try again.", variant: "destructive" });
      return;
    }
    setIsSyncing(true);
    try {
      const result = await syncPendingOrders(gasUrl);
      const newCount = await getPendingSyncCount();
      setPendingCount(newCount);
      toast({
        title: result.synced > 0 ? "Sync complete" : "Nothing to sync",
        description: result.synced > 0
          ? `${result.synced} order${result.synced !== 1 ? "s" : ""} synced to Google Sheets.`
          : result.failed > 0 ? `${result.failed} order(s) failed — check your endpoint URL.` : "All orders are up to date.",
        variant: result.failed > 0 ? "destructive" : "default",
      });
    } catch {
      toast({ title: "Sync failed", variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveSyncUrl = () => {
    setGasUrl(syncUrlInput);
    setGasUrlState(syncUrlInput);
    setShowSyncSettings(false);
    toast({ title: "Endpoint saved", description: "Google Sheets sync URL has been configured." });
  };

  const handleTestConnection = async () => {
    if (!syncUrlInput) return;
    setTestStatus("testing");
    const ok = await testGasConnection(syncUrlInput);
    setTestStatus(ok ? "ok" : "fail");
    setTimeout(() => setTestStatus("idle"), 4000);
  };

  const setField = <K extends keyof OrderForm>(key: K, val: OrderForm[K]) =>
    setForm(prev => ({ ...prev, [key]: val }));

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col xl:flex-row gap-5 h-full animate-in fade-in duration-500">

      {/* ── LEFT: Product Grid ── */}
      <div className="flex-1 flex flex-col gap-4 min-h-0">

        {/* Search + sync controls */}
        <div className="flex gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products by name or size..."
              className="pl-10 h-11 bg-card border-border"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Sync button */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              title={gasUrl ? "Sync to Google Sheets" : "Configure Google Sheets sync"}
              className={`h-11 px-3 rounded-lg border flex items-center gap-1.5 text-xs font-medium transition-colors ${
                pendingCount > 0
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary"
              }`}
            >
              {isSyncing
                ? <RefreshCw size={14} className="animate-spin" />
                : isOnline
                  ? <Wifi size={14} />
                  : <WifiOff size={14} />
              }
              {pendingCount > 0 && (
                <span className="font-bold">{pendingCount}</span>
              )}
            </button>
            <button
              onClick={() => { setSyncUrlInput(gasUrl); setShowSyncSettings(true); }}
              title="Sync settings"
              className="h-11 w-11 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <Settings2 size={15} />
            </button>
          </div>
        </div>

        {/* Products */}
        <div className="flex-1 overflow-y-auto">
          {filteredProducts.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Package size={32} className="opacity-20" />
              <p className="text-sm">
                {products.length === 0
                  ? "No products yet. Add products first."
                  : "No products match your search."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3 gap-3 pb-4">
              {filteredProducts.map(product => (
                <Card
                  key={product.id}
                  onClick={() => handleProductClick(product)}
                  className="bg-card border-border hover:border-primary/60 hover:shadow-md hover:shadow-primary/10 cursor-pointer transition-all duration-150 hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  <CardContent className="p-4 flex flex-col items-center text-center gap-1.5">
                    <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mb-1">
                      <Package size={20} className="text-primary" />
                    </div>
                    <p className="font-semibold text-sm leading-snug line-clamp-2 text-foreground">
                      {product.name}
                    </p>
                    <span className="text-[11px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full border border-border">
                      {product.portion_size}
                    </span>
                    <p className="font-bold text-primary tabular-nums">
                      {formatCurrency(product.price)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Cart + Order Form ── */}
      <div className="w-full xl:w-[460px] shrink-0 flex flex-col bg-card border border-border rounded-2xl shadow-xl shadow-black/20 overflow-hidden">

        {/* Cart header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-bold text-base flex items-center gap-2">
            <ShoppingCart size={18} className="text-primary" />
            Cart
            {cart.items.length > 0 && (
              <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                {cart.items.reduce((s, i) => s + i.qty, 0)}
              </span>
            )}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
            onClick={() => cart.items.length > 0 && setShowClearConfirm(true)}
            disabled={cart.items.length === 0}
          >
            <Trash2 size={13} className="mr-1" /> Clear
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* Cart items */}
          <div className="px-4 py-3">
            {cart.items.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center text-muted-foreground/40 gap-2">
                <ShoppingCart size={36} strokeWidth={1.2} />
                <p className="text-sm">Click a product to add it</p>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 pb-1">
                  <span>Product</span>
                  <span className="text-center w-20">Qty</span>
                  <span className="text-right w-16">Price</span>
                  <span className="text-right w-18">Subtotal</span>
                </div>
                {cart.items.map((item: CartItem) => (
                  <div
                    key={item.product_id}
                    className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center bg-background/50 rounded-lg px-2 py-2 border border-border/40"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug truncate">{item.product_name}</p>
                      <p className="text-[11px] text-muted-foreground">{item.portion_size}</p>
                    </div>
                    <div className="flex items-center gap-1 bg-secondary rounded-md p-0.5 w-20">
                      <button
                        className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                        onClick={() => cart.updateQty(item.product_id, item.qty - 1)}
                      >
                        <Minus size={11} />
                      </button>
                      <span className="flex-1 text-center text-sm font-semibold tabular-nums">{item.qty}</span>
                      <button
                        className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                        onClick={() => cart.updateQty(item.product_id, item.qty + 1)}
                      >
                        <Plus size={11} />
                      </button>
                    </div>
                    <span className="text-sm text-muted-foreground text-right w-16 tabular-nums">
                      {formatCurrency(item.price)}
                    </span>
                    <div className="flex items-center gap-1 w-18 justify-end">
                      <span className="text-sm font-bold text-foreground tabular-nums">
                        {formatCurrency(item.price * item.qty)}
                      </span>
                      <button
                        className="h-5 w-5 flex items-center justify-center text-muted-foreground/50 hover:text-destructive transition-colors"
                        onClick={() => cart.removeItem(item.product_id)}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator className="mx-4" />

          {/* Order form */}
          <div className="px-4 py-4 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Order Details</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Customer Name</Label>
                <Input
                  placeholder="Walk-in"
                  className="bg-background border-border h-9 text-sm"
                  value={form.customer_name}
                  onChange={e => setField("customer_name", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input
                  placeholder="Optional"
                  type="tel"
                  className="bg-background border-border h-9 text-sm"
                  value={form.customer_phone}
                  onChange={e => setField("customer_phone", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Ready Date & Time</Label>
              <Input
                type="datetime-local"
                className="bg-background border-border h-9 text-sm"
                value={form.ready_date}
                onChange={e => setField("ready_date", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Payment Method</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["Transfer", "QRIS"] as PaymentMethod[]).map(method => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setField("payment_method", method)}
                    className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${
                      form.payment_method === method
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {method === "Transfer" ? "💳 Transfer" : "📱 QRIS"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Fulfillment Method</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setField("fulfillment_method", "pickup")}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${
                    form.fulfillment_method === "pickup"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <ShoppingBag size={15} /> Ambil Sendiri
                </button>
                <button
                  type="button"
                  onClick={() => setField("fulfillment_method", "ojol")}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${
                    form.fulfillment_method === "ojol"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <Bike size={15} /> Ojol
                </button>
              </div>
              {form.fulfillment_method === "ojol" && (
                <p className="text-[11px] text-amber-400 flex items-center gap-1 mt-1">
                  <AlertCircle size={11} /> Biaya pengantaran ditanggung customer
                </p>
              )}
            </div>

            {form.fulfillment_method === "ojol" && (
              <div className="space-y-3 rounded-xl border border-border/60 bg-background/50 p-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Bike size={11} /> Delivery Details
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs">Delivery Address</Label>
                  <Textarea
                    placeholder="Enter delivery address..."
                    className="bg-background border-border text-sm resize-none min-h-[70px]"
                    value={form.delivery_address}
                    onChange={e => setField("delivery_address", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Delivery Notes</Label>
                  <Input
                    placeholder="e.g. Leave at door, call on arrival"
                    className="bg-background border-border h-9 text-sm"
                    value={form.delivery_notes}
                    onChange={e => setField("delivery_notes", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Estimated Delivery Fee</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">Rp</span>
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      className="bg-background border-border h-9 text-sm pl-9"
                      value={form.estimated_delivery_fee || ""}
                      onChange={e => setField("estimated_delivery_fee", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Order Notes</Label>
              <Textarea
                placeholder="Special instructions, allergies, etc."
                className="bg-background border-border text-sm resize-none min-h-[60px]"
                value={form.notes}
                onChange={e => setField("notes", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-secondary/20 px-4 py-4 space-y-3 shrink-0">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Items subtotal</span>
              <span className="tabular-nums">{formatCurrency(cart.getTotal())}</span>
            </div>
            {form.fulfillment_method === "ojol" && (
              <div className="flex justify-between text-muted-foreground">
                <span>Delivery fee</span>
                <span className="tabular-nums">{formatCurrency(form.estimated_delivery_fee || 0)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-1.5 border-t border-border/60">
              <span>Total</span>
              <span className="text-primary tabular-nums">{formatCurrency(grandTotal)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="border-border text-muted-foreground hover:text-destructive hover:border-destructive/50 hover:bg-destructive/5"
              onClick={() => cart.items.length > 0 && setShowClearConfirm(true)}
              disabled={cart.items.length === 0}
            >
              <Trash2 size={14} className="mr-1.5" /> Clear Cart
            </Button>
            <Button
              className="font-bold shadow-md shadow-primary/20"
              onClick={handleSaveOrder}
              disabled={isSaving || cart.items.length === 0}
            >
              <Save size={14} className="mr-1.5" />
              {isSaving ? "Saving..." : "Save Order"}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Qty Modal ── */}
      <Dialog open={!!selectedProduct} onOpenChange={open => !open && setSelectedProduct(null)}>
        <DialogContent className="sm:max-w-[320px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">{selectedProduct?.name}</DialogTitle>
            <DialogDescription className="text-sm">
              <span className="text-muted-foreground">{selectedProduct?.portion_size}</span>
              {" · "}
              <span className="text-primary font-semibold">
                {selectedProduct && formatCurrency(selectedProduct.price)}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Label className="text-sm">Quantity</Label>
            <div className="flex items-center justify-center gap-4">
              <button
                className="h-10 w-10 rounded-full border-2 border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                onClick={() => setQtyInput(q => Math.max(1, q - 1))}
              >
                <Minus size={16} />
              </button>
              <Input
                type="number"
                min="1"
                className="w-20 text-center text-xl font-bold bg-background border-border h-12"
                value={qtyInput}
                onChange={e => setQtyInput(Math.max(1, parseInt(e.target.value) || 1))}
              />
              <button
                className="h-10 w-10 rounded-full border-2 border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                onClick={() => setQtyInput(q => q + 1)}
              >
                <Plus size={16} />
              </button>
            </div>
            {selectedProduct && (
              <div className="bg-secondary/50 rounded-lg px-4 py-2.5 flex justify-between items-center border border-border/50">
                <span className="text-sm text-muted-foreground">Subtotal</span>
                <span className="font-bold text-primary tabular-nums">
                  {formatCurrency(selectedProduct.price * qtyInput)}
                </span>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setSelectedProduct(null)}>Cancel</Button>
            <Button className="font-bold flex-1" onClick={handleAddToCart}>
              <Plus size={14} className="mr-1" /> Add to Cart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Google Sheets Sync Settings ── */}
      <Dialog open={showSyncSettings} onOpenChange={setShowSyncSettings}>
        <DialogContent className="sm:max-w-[560px] bg-card border-border max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <RefreshCw size={16} className="text-primary" /> Google Sheets Sync
            </DialogTitle>
            <DialogDescription>
              Paste your Google Apps Script Web App URL below. Orders will be synced automatically when online.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 pr-1">
          <div className="space-y-4 py-2">
            {/* Status */}
            <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm ${
              isOnline
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-secondary border-border text-muted-foreground"
            }`}>
              {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
              <span>{isOnline ? "Connected to internet" : "Offline — sync will run automatically when connected"}</span>
            </div>

            {pendingCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-400 text-sm">
                <CloudOff size={14} />
                <span>{pendingCount} order{pendingCount !== 1 ? "s" : ""} pending sync</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Google Apps Script Endpoint URL</Label>
              <Input
                placeholder="https://script.google.com/macros/s/your-id/exec"
                className="bg-background border-border text-sm font-mono"
                value={syncUrlInput}
                onChange={e => setSyncUrlInput(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Deploy your Apps Script as a Web App with <strong>Execute as: Me</strong> and <strong>Who has access: Anyone</strong>.
              </p>
            </div>

            {/* GAS code hint */}
            <div className="rounded-lg bg-background border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Apps Script Template
                </p>
                <button
                  onClick={() => {
                    const code = document.getElementById("gas-code-block")?.textContent ?? "";
                    navigator.clipboard.writeText(code).then(() => {
                      const btn = document.getElementById("copy-gas-btn");
                      if (btn) { btn.textContent = "✓ Copied!"; setTimeout(() => { btn.textContent = "Copy"; }, 2000); }
                    });
                  }}
                  id="copy-gas-btn"
                  className="text-[11px] font-semibold text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/15 border border-primary/20 px-2.5 py-1 rounded-md transition-colors"
                >
                  Copy
                </button>
              </div>
              <pre id="gas-code-block" className="text-[10px] text-muted-foreground leading-relaxed overflow-y-auto overflow-x-auto whitespace-pre max-h-[200px] bg-background/50 rounded p-1">{`function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSheet();

    // Add header row if sheet is empty
    if (sheet.getLastRow() === 0) {
      var header = sheet.appendRow([
        "Order ID","Order Date","Ready Date","Customer",
        "Phone","Fulfillment","Address","Product",
        "Qty","Subtotal","Total","Payment","Status","Notes"
      ]);
      // Bold the header
      sheet.getRange(1, 1, 1, 14).setFontWeight("bold");
    }

    var data = JSON.parse(e.postData.contents);
    if (data.ping) {
      return ContentService.createTextOutput(
        JSON.stringify({ok:true})).setMimeType(
        ContentService.MimeType.JSON);
    }

    var fmt = "dd/mm/yyyy hh:mm"; // date format for Sheets
    data.rows.forEach(function(row) {
      var newRow = sheet.getLastRow() + 1;
      sheet.appendRow([
        row.order_id,
        row.order_date || "",  // serial number — formatted below
        row.ready_date || "",  // serial number — formatted below
        row.customer_name, row.customer_phone,
        row.fulfillment_method, row.delivery_address,
        row.product_name, row.qty, row.subtotal,
        row.total, row.payment_method, row.status, row.notes
      ]);
      // Apply date format to columns B and C so Sheets treats them as dates
      if (row.order_date) sheet.getRange(newRow, 2).setNumberFormat(fmt);
      if (row.ready_date) sheet.getRange(newRow, 3).setNumberFormat(fmt);
    });

    return ContentService.createTextOutput(
      JSON.stringify({ok:true})).setMimeType(
      ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(
      JSON.stringify({ok:false,error:err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`}</pre>
            </div>
          </div>
          </div>

          <DialogFooter className="gap-2 flex-wrap shrink-0">
            <Button variant="ghost" onClick={() => setShowSyncSettings(false)}>Cancel</Button>
            {syncUrlInput && (
              <Button
                variant="outline"
                className={`border-border ${
                  testStatus === "ok"   ? "border-emerald-500/50 text-emerald-400" :
                  testStatus === "fail" ? "border-destructive/50 text-destructive" : ""
                }`}
                disabled={testStatus === "testing"}
                onClick={handleTestConnection}
              >
                {testStatus === "testing" ? "Testing..." :
                 testStatus === "ok"      ? "✓ Reachable!" :
                 testStatus === "fail"    ? "✗ Failed" :
                 "Test Connection"}
              </Button>
            )}
            {pendingCount > 0 && syncUrlInput && (
              <Button
                variant="outline"
                className="border-border"
                onClick={() => { handleSaveSyncUrl(); setTimeout(handleManualSync, 100); }}
              >
                Save & Sync Now
              </Button>
            )}
            <Button onClick={handleSaveSyncUrl} className="font-bold">
              Save URL
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Clear Cart Confirmation ── */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Cart</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all {cart.items.length} item{cart.items.length !== 1 ? "s" : ""} from the cart. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-background border-border hover:bg-secondary">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold"
              onClick={() => { cart.clearCart(); setShowClearConfirm(false); }}
            >
              Clear Cart
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── WhatsApp Receipt Modal ── */}
      {receipt && (
        <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "font-bold" : ""}>{value}</span>
    </div>
  );
}
