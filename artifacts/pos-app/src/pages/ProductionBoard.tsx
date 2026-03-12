import { useLiveQuery } from "dexie-react-hooks";
import { db, type Order } from "@/database/db";
import { formatCurrency } from "@/utils/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Clock, CheckCircle2, ChefHat, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Status = Order['status'];

const columns: { id: Status; title: string; color: string; icon: any }[] = [
  { id: 'pending', title: 'Pending', color: 'border-l-amber-500', icon: Clock },
  { id: 'in-progress', title: 'Preparing', color: 'border-l-blue-500', icon: ChefHat },
  { id: 'ready', title: 'Ready', color: 'border-l-emerald-500', icon: CheckCircle2 },
];

export default function ProductionBoard() {
  const activeOrders = useLiveQuery(() => 
    db.orders.where('status').notEqual('delivered').toArray()
  ) || [];

  const updateStatus = async (id: number, newStatus: Status) => {
    await db.orders.update(id, { status: newStatus });
  };

  const getNextStatus = (current: Status): Status => {
    if (current === 'pending') return 'in-progress';
    if (current === 'in-progress') return 'ready';
    return 'delivered';
  };

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Production Board</h1>
        <p className="text-muted-foreground mt-1">Live order tracking for kitchen and fulfillment.</p>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 min-h-0">
        {columns.map(col => {
          const colOrders = activeOrders
            .filter(o => o.status === col.id)
            .sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

          return (
            <div key={col.id} className="flex flex-col bg-secondary/30 rounded-2xl p-4 border border-border/50">
              <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-2">
                  <col.icon size={18} className="text-muted-foreground" />
                  <h2 className="font-display font-bold text-lg">{col.title}</h2>
                </div>
                <span className="bg-background text-muted-foreground text-xs font-bold px-2 py-1 rounded-md border border-border">
                  {colOrders.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                {colOrders.map(order => (
                  <Card key={order.id} className={`bg-card border-border shadow-md border-l-4 ${col.color}`}>
                    <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between space-y-0">
                      <div>
                        <span className="font-mono font-bold text-primary">{order.orderNumber}</span>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock size={12} />
                          {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                      <ul className="space-y-1.5 mb-4">
                        {order.items.map((item, idx) => (
                          <li key={idx} className="text-sm flex justify-between">
                            <span className="text-foreground"><span className="font-bold text-muted-foreground mr-1">{item.quantity}x</span> {item.name}</span>
                          </li>
                        ))}
                      </ul>
                      
                      <Button 
                        className="w-full font-bold shadow-sm"
                        variant={col.id === 'ready' ? 'default' : 'secondary'}
                        onClick={() => order.id && updateStatus(order.id, getNextStatus(order.status))}
                      >
                        {col.id === 'pending' && "Start Preparing"}
                        {col.id === 'in-progress' && "Mark Ready"}
                        {col.id === 'ready' && "Deliver Order"}
                        <ArrowRight size={16} className="ml-2" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                
                {colOrders.length === 0 && (
                  <div className="h-32 flex items-center justify-center border-2 border-dashed border-border/50 rounded-xl text-muted-foreground/50 text-sm font-medium">
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
