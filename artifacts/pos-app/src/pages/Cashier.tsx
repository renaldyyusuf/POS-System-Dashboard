import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  db, createOrder, saveOrderItems, addToSyncQueue,
  type Product,
} from "@/database/db";
import { useCart, type CartItem } from "@/hooks/useCart";
import { formatCurrency } from "@/utils/format";
import {
  Search, Trash2, ShoppingCart, Package, Plus, Minus, X,
  Bike, ShoppingBag, Save, AlertCircle,
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
  getGasUrl, syncPendingOrders, startAutoSync,
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
  const [mobileTab, setMobileTab] = useState<"products" | "cart">("products");
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  // Google Sheets sync state
  const [gasUrl] = useState(getGasUrl);

  const { toast } = useToast();
  const cart = useCart();

  // Load QRIS image from store settings to enable/disable QRIS payment
  const storeSettings = useLiveQuery(() => db.store_settings.toCollection().first());
  const qrisImage = storeSettings?.qris_image ?? "";

  const products = useLiveQuery(() => db.products.toArray(), []) || [];

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.portion_size.toLowerCase().includes(search.toLowerCase())
  );

  const grandTotal = cart.getTotal() +
    (form.fulfillment_method === "ojol" ? (form.estimated_delivery_fee || 0) : 0);

  // ── Lifecycle ──────────────────────────────────────────────────────────

  useEffect(() => {
    const cleanup = startAutoSync();
    return cleanup;
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
    setMobileTab("cart");
    toast({ title: "Ditambahkan ke keranjang", description: `${qtyInput}× ${selectedProduct.name} ditambahkan` });
  };

  const handleSaveOrder = async () => {
    if (cart.items.length === 0) {
      toast({ title: "Keranjang kosong", description: "Tambahkan produk sebelum menyimpan.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const readyIso = form.ready_date
        ? new Date(form.ready_date).toISOString()
        : now;

      const orderId = await createOrder({
        customer_name: form.customer_name || "Tanpa nama",
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

      // Try to sync immediately if online and URL is configured
      if (navigator.onLine && gasUrl) {
        syncPendingOrders(gasUrl)
          .then(async result => {
            if (result.synced > 0) {
            }
          })
          .catch(() => {});
      }

      // ── Show receipt modal ──────────────────────────────────────────
      setReceipt({
        orderId,
        orderDate: now,
        readyDate: readyIso,
        customerName: form.customer_name || "Tanpa nama",
        customerPhone: form.customer_phone,
        paymentMethod: form.payment_method,
        fulfillmentMethod: form.fulfillment_method,
        deliveryAddress: form.delivery_address,
        deliveryFee: form.estimated_delivery_fee || 0,
        notes: form.notes,
        items: orderItems,
        total: grandTotal,
        storeName:    storeSettings?.store_name,
        storeAddress: storeSettings?.store_address,
        mapsUrl:      storeSettings?.maps_url,
      });

      cart.clearCart();
      setForm(defaultForm());
    } catch {
      toast({ title: "Gagal menyimpan pesanan", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };




  const setField = <K extends keyof OrderForm>(key: K, val: OrderForm[K]) =>
    setForm(prev => ({ ...prev, [key]: val }));

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col xl:flex-row gap-5 h-full animate-in fade-in duration-500">

      {/* ── Mobile Tab Switcher (hidden on xl+) ── */}
      <div className="flex xl:hidden shrink-0 bg-secondary/60 rounded-xl p-1 gap-1 border border-border">
        <button
          onClick={() => setMobileTab("products")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            mobileTab === "products"
              ? "bg-card text-foreground shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Package size={15} /> Produk
        </button>
        <button
          onClick={() => setMobileTab("cart")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            mobileTab === "cart"
              ? "bg-card text-foreground shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShoppingCart size={15} /> Keranjang
          {cart.items.length > 0 && (
            <span className="bg-primary text-primary-foreground text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
              {cart.items.reduce((s, i) => s + i.qty, 0)}
            </span>
          )}
        </button>
      </div>

      {/* ── LEFT: Product Grid ── */}
      <div className={`flex-1 flex flex-col gap-4 min-h-0 ${mobileTab === "cart" ? "hidden xl:flex" : "flex"}`}>

        {/* Search + sync controls */}
        <div className="flex gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari produk berdasarkan nama atau ukuran..."
              className="pl-10 h-11 bg-card border-border"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>


        </div>

        {/* Products */}
        <div className="flex-1 overflow-y-auto">
          {filteredProducts.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Package size={32} className="opacity-20" />
              <p className="text-sm">
                {products.length === 0
                  ? "Belum ada produk. Tambahkan produk terlebih dahulu."
                  : "Tidak ada produk yang cocok."}
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
      <div className={`w-full xl:w-[460px] shrink-0 flex-col bg-card border border-border rounded-2xl shadow-xl shadow-black/20 overflow-hidden ${mobileTab === "products" ? "hidden xl:flex" : "flex"}`}>

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
                <div className="grid grid-cols-[1fr_auto_auto] gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 pb-1">
                  <span>Product</span>
                  <span className="text-center w-20">Qty</span>
                  <span className="text-right">Subtotal</span>
                </div>
                {cart.items.map((item: CartItem) => (
                  <div
                    key={item.product_id}
                    className="grid grid-cols-[1fr_auto_auto] gap-2 items-center bg-background/50 rounded-lg px-2 py-2 border border-border/40"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug truncate">{item.product_name}</p>
                      <p className="text-[11px] text-muted-foreground">{item.portion_size} · {formatCurrency(item.price)}</p>
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
                    <div className="flex items-center gap-1 justify-end">
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
                  placeholder="Tanpa nama"
                  className="bg-background border-border h-9 text-sm"
                  value={form.customer_name}
                  onChange={e => setField("customer_name", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input
                  placeholder="Opsional"
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
                <button
                    type="button"
                    onClick={() => setField("payment_method", "Transfer")}
                    className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${
                      form.payment_method === "Transfer"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    💳 Transfer
                  </button>
                  <div className="relative group">
                    <button
                      type="button"
                      onClick={() => qrisImage ? setField("payment_method", "QRIS") : undefined}
                      disabled={!qrisImage}
                      className={`w-full py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${
                        !qrisImage
                          ? "border-border/40 bg-background/50 text-muted-foreground/40 cursor-not-allowed"
                          : form.payment_method === "QRIS"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      📱 QRIS
                    </button>
                    {!qrisImage && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-popover border border-border rounded-lg text-[11px] text-muted-foreground whitespace-nowrap shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        Upload QRIS di Pengaturan Toko dulu
                      </div>
                    )}
                  </div>
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
                  <Label className="text-xs">Alamat Pengiriman</Label>
                  <Textarea
                    placeholder="Masukkan alamat pengiriman..."
                    className="bg-background border-border text-sm resize-none min-h-[70px]"
                    value={form.delivery_address}
                    onChange={e => setField("delivery_address", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Delivery Notes</Label>
                  <Input
                    placeholder="cth. Titip di depan pintu, hubungi saat tiba"
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
                placeholder="Instruksi khusus, alergi, dll."
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
                <span>Ongkos Kirim</span>
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
              {isSaving ? "Menyimpan..." : "Simpan Pesanan"}
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


      {/* ── Clear Cart Confirmation ── */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Kosongkan Keranjang</AlertDialogTitle>
            <AlertDialogDescription>
              Semua {cart.items.length} item di keranjang akan dihapus. Lanjutkan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-background border-border hover:bg-secondary">Batal</AlertDialogCancel>
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
