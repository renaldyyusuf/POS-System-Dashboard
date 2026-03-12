import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/database/db";
import { formatCurrency } from "@/utils/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { DollarSign, ShoppingBag, TrendingUp, Clock } from "lucide-react";
import { startOfDay, format, subDays, isAfter } from "date-fns";

export default function Dashboard() {
  const today = startOfDay(new Date());

  const recentOrders = useLiveQuery(() =>
    db.orders.where("created_at").aboveOrEqual(subDays(today, 6).toISOString()).toArray()
  );

  const allActiveOrders = useLiveQuery(() =>
    db.orders.where("status").noneOf(["delivered"]).toArray()
  );

  const todaySales = (recentOrders || [])
    .filter(o => isAfter(new Date(o.created_at), today) && !o.is_void)
    .reduce((s, o) => s + o.total, 0);

  const todayOrders = (recentOrders || [])
    .filter(o => isAfter(new Date(o.created_at), today) && !o.is_void).length;

  const activeCount = (allActiveOrders || []).filter(o => !o.is_void).length;

  const chartData: { date: string; sales: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = subDays(today, i);
    const label = format(d, "MMM dd");
    const dayTotal = (recentOrders || [])
      .filter(o => !o.is_void && format(new Date(o.created_at), "MMM dd") === label)
      .reduce((s, o) => s + o.total, 0);
    chartData.push({ date: label, sales: dayTotal });
  }

  const weekTotal = chartData.reduce((s, d) => s + d.sales, 0);

  const stats = [
    { title: "Today's Sales", value: formatCurrency(todaySales), icon: DollarSign, color: "text-emerald-400", bg: "bg-emerald-400/10" },
    { title: "Orders Today", value: String(todayOrders), icon: ShoppingBag, color: "text-blue-400", bg: "bg-blue-400/10" },
    { title: "Active Orders", value: String(activeCount), icon: Clock, color: "text-amber-400", bg: "bg-amber-400/10" },
    { title: "7-Day Revenue", value: formatCurrency(weekTotal), icon: TrendingUp, color: "text-primary", bg: "bg-primary/10" },
  ];

  const recentList = [...(recentOrders || [])]
    .filter(o => !o.is_void)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your store's performance today.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((stat, i) => (
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
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} dy={8} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted))" }}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }}
                    itemStyle={{ color: "hsl(var(--primary))" }}
                    formatter={(v: number) => [formatCurrency(v), "Sales"]}
                  />
                  <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-lg shadow-black/20">
          <CardHeader>
            <CardTitle className="font-display">Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {recentList.length > 0 ? (
              <div className="space-y-4 mt-1">
                {recentList.map(order => (
                  <div key={order.id} className="flex items-center justify-between border-b border-border/50 last:border-0 pb-3 last:pb-0">
                    <div>
                      <p className="font-medium text-sm text-foreground">{order.customer_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">#{order.id} · {format(new Date(order.created_at), "h:mm a")}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-foreground">{formatCurrency(order.total)}</p>
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full mt-1 inline-block
                        ${order.status === "delivered" ? "bg-emerald-500/10 text-emerald-400" :
                          order.status === "ready" ? "bg-blue-500/10 text-blue-400" :
                          "bg-amber-500/10 text-amber-400"}`}
                      >
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                No recent orders
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
