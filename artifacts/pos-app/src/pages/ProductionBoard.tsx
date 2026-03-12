import { useLiveQuery } from "dexie-react-hooks";
import { db, updateOrderStatus, type Order } from "@/database/db";
import { formatCurrency } from "@/utils/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Clock, CheckCircle2, ChefHat, ArrowRight, Truck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const COLUMNS: { id: string; title: string; color: string; icon: React.ElementType }[] = [
  { id: "pending", title: "Pending", color: "border-l-amber-500", icon: Clock },
  { id: "in-progress", title: "Preparing", color: "border-l-blue-500", icon: ChefHat },
  { id: "ready", title: "Ready", color: "border-l-emerald-500", icon: CheckCircle2 },
  { id: "delivered", title: "Delivered", color: "border-l-slate-500", icon: Truck },
];

const NEXT_STATUS: Record<string, string> = {
  pending: "in-progress",
  "in-progress": "ready",
  ready: "delivered",
};

const BUTTON_LABEL: Record<string, string> = {
  pending: "Start Preparing",
  "in-progress": "Mark Ready",
  ready: "Mark Delivered",
};

export default function ProductionBoard() {
  const activeOrders = useLiveQuery(() =>
    db.orders.filter(o => !o.is_void).toArray()
  ) || [];

  const handleAdvance = async (order: Order) => {
    const next = NEXT_STATUS[order.status];
    if (next && order.id) {
      await updateOrderStatus(order.id, next);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Production Board</h1>
        <p className="text-muted-foreground mt-1">Live order tracking for kitchen and fulfillment.</p>
      </div>

      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 min-h-0">
        {COLUMNS.map(col => {
          const colOrders = activeOrders
            .filter(o => o.status === col.id)
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

          return (
            <div key={col.id} className="flex flex-col bg-secondary/30 rounded-2xl p-4 border border-border/50 min-h-[300px]">
              <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                  <col.icon size={16} className="text-muted-foreground" />
                  <h2 className="font-bold text-base">{col.title}</h2>
                </div>
                <span className="bg-background text-muted-foreground text-xs font-bold px-2 py-0.5 rounded-md border border-border">
                  {colOrders.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 scrollbar-hide">
                {colOrders.map(order => (
                  <Card key={order.id} className={`bg-card border-border shadow-md border-l-4 ${col.color}`}>
                    <CardHeader className="p-3 pb-2 space-y-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-bold text-primary text-sm">#{order.id}</span>
                          <p className="text-xs font-medium text-foreground mt-0.5">{order.customer_name}</p>
                        </div>
                        <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded-full capitalize">
                          {order.fulfillment_method}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Clock size={10} />
                        {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <p className="text-sm font-bold text-primary mb-3">{formatCurrency(order.total)}</p>
                      {order.notes && (
                        <p className="text-xs text-muted-foreground bg-secondary/50 rounded-md px-2 py-1 mb-3 italic">
                          {order.notes}
                        </p>
                      )}
                      {NEXT_STATUS[col.id] && (
                        <Button
                          className="w-full font-semibold text-xs h-8"
                          variant={col.id === "ready" ? "default" : "secondary"}
                          onClick={() => handleAdvance(order)}
                          size="sm"
                        >
                          {BUTTON_LABEL[col.id]}
                          <ArrowRight size={13} className="ml-1.5" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}

                {colOrders.length === 0 && (
                  <div className="h-24 flex items-center justify-center border-2 border-dashed border-border/40 rounded-xl text-muted-foreground/40 text-xs font-medium">
                    No orders {col.title.toLowerCase()}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
