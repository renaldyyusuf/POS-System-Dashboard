import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, createOrder, saveOrderItems } from "@/database/db";
import { useCart } from "@/hooks/useCart";
import { formatCurrency } from "@/utils/format";
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, ShoppingCart, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function Cashier() {
  const [search, setSearch] = useState("");
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [fulfillmentMethod, setFulfillmentMethod] = useState<string>("dine-in");
  const [notes, setNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const { toast } = useToast();
  const cart = useCart();

  const products = useLiveQuery(() => db.products.toCollection().toArray(), []) || [];

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.portion_size.toLowerCase().includes(search.toLowerCase())
  );

  const handleCheckout = async () => {
    if (cart.items.length === 0) return;
    setIsProcessing(true);
    try {
      const orderId = await createOrder({
        customer_name: customerName || "Walk-in",
        customer_phone: customerPhone,
        ready_date: new Date().toISOString(),
        payment_method: paymentMethod,
        total: cart.getTotal(),
        status: "pending",
        fulfillment_method: fulfillmentMethod,
        delivery_address: "",
        delivery_notes: "",
        estimated_delivery_fee: 0,
        notes,
      });

      await saveOrderItems(
        cart.items.map(item => ({
          order_id: orderId,
          product_name: item.product_name,
          qty: item.qty,
          price: item.price,
          subtotal: item.price * item.qty,
        }))
      );

      toast({
        title: "Order Placed",
        description: `Order #${orderId} for ${customerName || "Walk-in"} created.`,
      });

      cart.clearCart();
      setPaymentModalOpen(false);
      setCustomerName("");
      setCustomerPhone("");
      setNotes("");
    } catch {
      toast({ title: "Error", description: "Failed to process order", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 animate-in fade-in duration-500">
      {/* Left: Product Grid */}
      <div className="flex-1 flex flex-col gap-4 min-h-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            className="pl-10 h-12 bg-card border-border text-base rounded-xl"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto pb-4 pr-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredProducts.map(product => (
              <Card
                key={product.id}
                className="bg-card border-border hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all duration-200 cursor-pointer group hover:-translate-y-0.5"
                onClick={() => cart.addItem(product as any)}
              >
                <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Package size={18} className="text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground text-sm leading-tight line-clamp-2">{product.name}</h3>
                  <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{product.portion_size}</span>
                  <p className="text-primary font-bold">{formatCurrency(product.price)}</p>
                </CardContent>
              </Card>
            ))}
            {filteredProducts.length === 0 && (
              <div className="col-span-full h-40 flex flex-col items-center justify-center text-muted-foreground">
                <Package size={36} className="mb-2 opacity-20" />
                <p className="text-sm">No products found.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-full lg:w-[380px] shrink-0 flex flex-col bg-card rounded-2xl border border-border shadow-xl shadow-black/20 overflow-hidden h-[580px] lg:h-auto">
        <div className="p-5 border-b border-border">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ShoppingCart className="text-primary" size={20} />
            Current Order
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50 gap-3">
              <ShoppingCart size={40} strokeWidth={1} />
              <p className="text-sm">Cart is empty</p>
            </div>
          ) : (
            cart.items.map(item => (
              <div key={item.product_id} className="flex gap-3 items-center bg-background/60 p-3 rounded-xl border border-border/50">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.product_name}</p>
                  <p className="text-xs text-muted-foreground">{item.portion_size}</p>
                  <p className="text-primary text-sm font-semibold">{formatCurrency(item.price * item.qty)}</p>
                </div>
                <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded" onClick={() => cart.updateQty(item.product_id, item.qty - 1)}>
                    <Minus size={12} />
                  </Button>
                  <span className="w-5 text-center text-sm font-medium">{item.qty}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded" onClick={() => cart.updateQty(item.product_id, item.qty + 1)}>
                    <Plus size={12} />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-border bg-secondary/30">
          <div className="flex justify-between text-lg font-bold mb-4">
            <span>Total</span>
            <span className="text-primary">{formatCurrency(cart.getTotal())}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" className="border-destructive/30 text-destructive hover:bg-destructive/10" onClick={cart.clearCart} disabled={cart.items.length === 0}>
              <Trash2 size={16} />
            </Button>
            <Button className="flex-1 font-bold" disabled={cart.items.length === 0} onClick={() => setPaymentModalOpen(true)}>
              Charge {formatCurrency(cart.getTotal())}
            </Button>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="sm:max-w-[460px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Complete Order</DialogTitle>
            <DialogDescription>Fill in customer details and select payment method.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Customer Name</Label>
                <Input placeholder="Walk-in" className="bg-background border-border" value={customerName} onChange={e => setCustomerName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input placeholder="Optional" className="bg-background border-border" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Fulfillment</Label>
              <div className="grid grid-cols-3 gap-2">
                {["dine-in", "takeout", "delivery"].map(method => (
                  <button
                    key={method}
                    onClick={() => setFulfillmentMethod(method)}
                    className={`py-2 rounded-lg text-sm font-medium capitalize border transition-all ${fulfillmentMethod === method ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/40"}`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPaymentMethod("cash")}
                  className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${paymentMethod === "cash" ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-border bg-background text-muted-foreground hover:border-emerald-500/50"}`}
                >
                  <Banknote size={20} />
                  <span className="font-semibold">Cash</span>
                </button>
                <button
                  onClick={() => setPaymentMethod("card")}
                  className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${paymentMethod === "card" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/50"}`}
                >
                  <CreditCard size={20} />
                  <span className="font-semibold">Card</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input placeholder="Special instructions..." className="bg-background border-border" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>

            <div className="flex justify-between font-bold text-lg pt-2 border-t border-border">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(cart.getTotal())}</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPaymentModalOpen(false)}>Cancel</Button>
            <Button className="font-bold" onClick={handleCheckout} disabled={isProcessing}>
              {isProcessing ? "Processing..." : "Confirm Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
