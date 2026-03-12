import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Product } from "@/database/db";
import { useCart } from "@/hooks/useCart";
import { formatCurrency, generateOrderNumber } from "@/utils/format";
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, Receipt } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export default function Cashier() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash'|'card'>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { toast } = useToast();
  const cart = useCart();

  const products = useLiveQuery(() => {
    let collection = db.products.toCollection();
    return collection.toArray();
  }, []) || [];

  const categories = ["All", ...Array.from(new Set(products.map(p => p.category)))];

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCat = category === "All" || p.category === category;
    return matchesSearch && matchesCat;
  });

  const handleCheckout = async () => {
    if (cart.items.length === 0) return;
    
    setIsProcessing(true);
    
    try {
      // Simulate slight processing delay for feel
      await new Promise(r => setTimeout(r, 800));
      
      const newOrder = {
        orderNumber: generateOrderNumber(),
        items: cart.items,
        subtotal: cart.getSubtotal(),
        tax: cart.getTax(),
        total: cart.getTotal(),
        paymentMethod,
        status: 'pending' as const,
        createdAt: new Date().toISOString()
      };

      await db.orders.add(newOrder);
      
      toast({
        title: "Order Successful",
        description: `Order ${newOrder.orderNumber} has been placed.`,
      });
      
      cart.clearCart();
      setPaymentModalOpen(false);
      
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process order",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 animate-in fade-in duration-500">
      {/* Left side - Product Grid */}
      <div className="flex-1 flex flex-col gap-6 min-h-0">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="Search products..." 
              className="pl-10 h-12 bg-card border-border text-base rounded-xl focus-visible:ring-primary shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide shrink-0">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`
                px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200
                ${category === cat 
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25' 
                  : 'bg-card text-muted-foreground border border-border hover:border-primary/50 hover:text-foreground'
                }
              `}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto pb-4 pr-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map(product => (
              <Card 
                key={product.id} 
                className="bg-card border-border hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all duration-200 cursor-pointer group hover:-translate-y-1"
                onClick={() => cart.addItem(product)}
              >
                <CardContent className="p-4 flex flex-col items-center justify-center text-center aspect-square relative">
                  <span className="text-5xl mb-3 group-hover:scale-110 transition-transform duration-300">{product.emoji}</span>
                  <h3 className="font-semibold text-foreground line-clamp-1">{product.name}</h3>
                  <p className="text-primary font-bold mt-1">{formatCurrency(product.price)}</p>
                  
                  <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 rounded-xl transition-colors" />
                </CardContent>
              </Card>
            ))}
          </div>
          {filteredProducts.length === 0 && (
            <div className="h-full flex items-center justify-center text-muted-foreground flex-col">
              <Package size={48} className="mb-4 opacity-20" />
              <p>No products found.</p>
            </div>
          )}
        </div>
      </div>

      {/* Right side - Cart */}
      <div className="w-full lg:w-[400px] shrink-0 flex flex-col bg-card rounded-2xl border border-border shadow-xl shadow-black/20 overflow-hidden h-[600px] lg:h-auto">
        <div className="p-5 border-b border-border bg-card/50 backdrop-blur-sm z-10">
          <h2 className="text-xl font-display font-bold flex items-center gap-2">
            <ShoppingCart className="text-primary" />
            Current Order
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {cart.items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground/60 space-y-4">
              <ShoppingCart size={48} strokeWidth={1} />
              <p>Cart is empty</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.items.map(item => (
                <div key={item.productId} className="flex gap-3 items-center bg-background/50 p-3 rounded-xl border border-border/50">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-foreground truncate">{item.name}</h4>
                    <p className="text-sm text-primary font-semibold">{formatCurrency(item.price)}</p>
                  </div>
                  
                  <div className="flex items-center gap-2 bg-secondary rounded-lg p-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-md hover:bg-background text-muted-foreground hover:text-foreground"
                      onClick={() => cart.updateQuantity(item.productId, item.quantity - 1)}
                    >
                      <Minus size={14} />
                    </Button>
                    <span className="w-6 text-center font-medium text-sm">{item.quantity}</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-md hover:bg-background text-muted-foreground hover:text-foreground"
                      onClick={() => cart.updateQuantity(item.productId, item.quantity + 1)}
                    >
                      <Plus size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-5 bg-secondary/50 border-t border-border mt-auto">
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-muted-foreground text-sm">
              <span>Subtotal</span>
              <span>{formatCurrency(cart.getSubtotal())}</span>
            </div>
            <div className="flex justify-between text-muted-foreground text-sm">
              <span>Tax (8%)</span>
              <span>{formatCurrency(cart.getTax())}</span>
            </div>
            <div className="flex justify-between text-foreground text-xl font-display font-bold pt-2 border-t border-border/50">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(cart.getTotal())}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="px-4 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors"
              onClick={cart.clearCart}
              disabled={cart.items.length === 0}
            >
              <Trash2 size={18} />
            </Button>
            <Button 
              className="flex-1 h-12 text-lg font-bold shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all duration-200"
              disabled={cart.items.length === 0}
              onClick={() => setPaymentModalOpen(true)}
            >
              Charge {formatCurrency(cart.getTotal())}
            </Button>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="sm:max-w-[425px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-2xl font-display">Complete Payment</DialogTitle>
            <DialogDescription>
              Select payment method for {formatCurrency(cart.getTotal())}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 py-6">
            <button
              onClick={() => setPaymentMethod('card')}
              className={`
                flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 transition-all duration-200
                ${paymentMethod === 'card' 
                  ? 'border-primary bg-primary/10 text-primary shadow-md shadow-primary/10' 
                  : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:bg-secondary'
                }
              `}
            >
              <CreditCard size={32} />
              <span className="font-semibold">Credit Card</span>
            </button>
            <button
              onClick={() => setPaymentMethod('cash')}
              className={`
                flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 transition-all duration-200
                ${paymentMethod === 'cash' 
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-md shadow-emerald-500/10' 
                  : 'border-border bg-background text-muted-foreground hover:border-emerald-500/50 hover:bg-secondary'
                }
              `}
            >
              <Banknote size={32} />
              <span className="font-semibold">Cash</span>
            </button>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setPaymentModalOpen(false)}>Cancel</Button>
            <Button 
              className="w-full sm:w-auto font-bold" 
              onClick={handleCheckout} 
              disabled={isProcessing}
            >
              {isProcessing ? "Processing..." : `Confirm ${formatCurrency(cart.getTotal())}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
