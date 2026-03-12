import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getOrderItems, type Order, type OrderItem } from "@/database/db";
import { formatCurrency } from "@/utils/format";
import { FileText, Search, CreditCard, Banknote, ChevronDown, ChevronUp, User, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_COLORS: Record<string, string> = {
  delivered: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  ready: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "in-progress": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  pending: "bg-secondary text-muted-foreground border-border",
  void: "bg-destructive/10 text-destructive border-destructive/20",
};

function OrderRow({ order }: { order: Order }) {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<OrderItem[]>([]);

  const handleExpand = async () => {
    if (!expanded && order.id) {
      const fetched = await getOrderItems(order.id);
      setItems(fetched);
    }
    setExpanded(prev => !prev);
  };

  const statusKey = order.is_void ? "void" : order.status;

  return (
    <>
      <TableRow
        className="border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer"
        onClick={handleExpand}
      >
        <TableCell className="font-mono text-primary/90 font-medium">#{order.id}</TableCell>
        <TableCell>
          <div className="flex items-center gap-1.5">
            <User size={13} className="text-muted-foreground" />
            <span className="text-sm">{order.customer_name}</span>
          </div>
          {order.customer_phone && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <Phone size={11} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{order.customer_phone}</span>
            </div>
          )}
        </TableCell>
        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
          {new Date(order.created_at).toLocaleString()}
        </TableCell>
        <TableCell>
          <span className="text-xs capitalize bg-secondary text-muted-foreground px-2 py-0.5 rounded-full border border-border">
            {order.fulfillment_method}
          </span>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {order.payment_method === "card" ? <CreditCard size={13} /> : <Banknote size={13} />}
            <span className="capitalize">{order.payment_method}</span>
          </div>
        </TableCell>
        <TableCell>
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${STATUS_COLORS[statusKey] || STATUS_COLORS.pending}`}>
            {statusKey}
          </span>
        </TableCell>
        <TableCell className="text-right font-bold">{formatCurrency(order.total)}</TableCell>
        <TableCell className="text-center">
          {expanded ? <ChevronUp size={16} className="text-muted-foreground inline" /> : <ChevronDown size={16} className="text-muted-foreground inline" />}
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow className="bg-secondary/20 border-border/30">
          <TableCell colSpan={8} className="py-3 px-6">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Order Items</p>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No items found.</p>
              ) : (
                items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span><span className="font-bold text-muted-foreground">{item.qty}×</span> {item.product_name}</span>
                    <span className="text-primary font-medium">{formatCurrency(item.subtotal)}</span>
                  </div>
                ))
              )}
              {order.notes && (
                <p className="text-xs text-muted-foreground pt-2 border-t border-border/50 mt-2">
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

export default function Orders() {
  const [search, setSearch] = useState("");

  const orders = useLiveQuery(() =>
    db.orders.orderBy("created_at").reverse().toArray()
  ) || [];

  const filteredOrders = orders.filter(o =>
    o.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    String(o.id).includes(search)
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Order History</h1>
        <p className="text-muted-foreground mt-1">View and manage past transactions.</p>
      </div>

      <Card className="bg-card border-border shadow-xl shadow-black/10 overflow-hidden">
        <div className="p-4 border-b border-border/50 bg-card/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer or order ID..."
              className="pl-9 bg-background border-border"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <Table>
          <TableHeader className="bg-secondary/50">
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead>Order #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Fulfillment</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-48 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center">
                    <FileText className="h-10 w-10 mb-3 opacity-20" />
                    No orders found.
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => <OrderRow key={order.id} order={order} />)
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
