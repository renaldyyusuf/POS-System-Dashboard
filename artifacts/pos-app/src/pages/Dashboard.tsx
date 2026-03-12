import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/database/db";
import { formatCurrency } from "@/utils/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { DollarSign, ShoppingBag, TrendingUp, Clock } from "lucide-react";
import { startOfDay, format, subDays, isAfter } from "date-fns";

export default function Dashboard() {
  const today = startOfDay(new Date());
  
  const recentOrders = useLiveQuery(() => 
    db.orders.where('createdAt').aboveOrEqual(subDays(today, 6).toISOString()).toArray()
  );

  const stats = {
    todaySales: 0,
    todayOrders: 0,
    pendingOrders: 0,
    weeklyGrowth: 0,
  };

  const chartData: any[] = [];
  
  if (recentOrders) {
    // Calculate stats
    recentOrders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      if (isAfter(orderDate, today)) {
        stats.todaySales += order.total;
        stats.todayOrders += 1;
        if (order.status !== 'delivered') {
          stats.pendingOrders += 1;
        }
      }
    });

    // Group for chart (last 7 days)
    for (let i = 6; i >= 0; i--) {
      const d = subDays(today, i);
      const dateStr = format(d, 'MMM dd');
      const dayOrders = recentOrders.filter(o => 
        format(new Date(o.createdAt), 'MMM dd') === dateStr
      );
      
      chartData.push({
        date: dateStr,
        sales: dayOrders.reduce((sum, o) => sum + o.total, 0)
      });
    }
  }

  const statCards = [
    {
      title: "Today's Sales",
      value: formatCurrency(stats.todaySales),
      icon: DollarSign,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
    },
    {
      title: "Orders Today",
      value: stats.todayOrders.toString(),
      icon: ShoppingBag,
      color: "text-blue-400",
      bg: "bg-blue-400/10",
    },
    {
      title: "Active Orders",
      value: stats.pendingOrders.toString(),
      icon: Clock,
      color: "text-amber-400",
      bg: "bg-amber-400/10",
    },
    {
      title: "7-Day Revenue",
      value: formatCurrency(chartData.reduce((sum, d) => sum + d.sales, 0)),
      icon: TrendingUp,
      color: "text-primary",
      bg: "bg-primary/10",
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your store's performance today.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {statCards.map((stat, i) => (
          <Card key={i} className="bg-card border-border hover:border-primary/30 transition-colors shadow-lg shadow-black/20">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                <h3 className="text-3xl font-bold font-display text-foreground mt-2">{stat.value}</h3>
              </div>
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${stat.bg}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-card border-border shadow-lg shadow-black/20">
          <CardHeader>
            <CardTitle className="font-display">Revenue Overview (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip 
                    cursor={{fill: 'hsl(var(--muted))'}}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))'
                    }}
                    itemStyle={{ color: 'hsl(var(--primary))' }}
                  />
                  <Bar 
                    dataKey="sales" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]} 
                    maxBarSize={50}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-lg shadow-black/20">
          <CardHeader>
            <CardTitle className="font-display">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentOrders && recentOrders.length > 0 ? (
              <div className="space-y-6 mt-2">
                {recentOrders.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5).map((order) => (
                  <div key={order.id} className="flex items-center justify-between border-b border-border/50 last:border-0 pb-4 last:pb-0">
                    <div>
                      <p className="font-medium text-foreground">{order.orderNumber}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(order.createdAt), 'h:mm a')} • {order.items.length} items
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">{formatCurrency(order.total)}</p>
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full mt-1 inline-block
                        ${order.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-400' : 
                          order.status === 'ready' ? 'bg-blue-500/10 text-blue-400' : 
                          'bg-amber-500/10 text-amber-400'}`}
                      >
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                <p>No recent orders</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
