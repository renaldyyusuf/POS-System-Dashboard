import { useState, useEffect } from "react";
import { onOrdersSnapshot, type Order } from "@/database/db";
import { formatCurrency, formatCurrencyCompact } from "@/utils/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { DollarSign, ShoppingBag, TrendingUp, Clock } from "lucide-react";
import { startOfDay, format, subDays, isAfter } from "date-fns";
import { id as idLocale } from "date-fns/locale";

const STATUS_ID: Record<string, string> = {
  pending:       "Menunggu",
  "in-progress": "Diproses",
  ready:         "Siap",
  delivered:     "Selesai",
};

const STATUS_COLOR: Record<string, string> = {
  pending:       "bg-amber-500/10 text-amber-400",
  "in-progress": "bg-blue-500/10 text-blue-400",
  ready:         "bg-emerald-500/10 text-emerald-400",
  delivered:     "bg-slate-500/10 text-slate-400",
};

export default function Dashboard() {
  const today = startOfDay(new Date());

  const [allOrders, setAllOrders] = useState<Order[]>([]);
  useEffect(() => onOrdersSnapshot(setAllOrders), []);

  const recentOrders = allOrders.filter(o =>
    new Date(o.created_at) >= subDays(today, 6)
  );
  const allActiveOrders = allOrders.filter(o => o.status !== "delivered");

  const todaySales = (recentOrders || [])
    .filter(o => isAfter(new Date(o.created_at), today) && !o.is_void)
    .reduce((s, o) => s + o.total, 0);

  const todayOrders = (recentOrders || [])
    .filter(o => isAfter(new Date(o.created_at), today) && !o.is_void).length;

  const activeCount = (allActiveOrders || []).filter(o => !o.is_void).length;

  const chartData: { date: string; sales: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = subDays(today, i);
    const key = format(d, "yyyy-MM-dd");
    const label = format(d, "EEE", { locale: idLocale });
    const dayTotal = (recentOrders || [])
      .filter(o => !o.is_void && format(new Date(o.created_at), "yyyy-MM-dd") === key)
      .reduce((s, o) => s + o.total, 0);
    chartData.push({ date: label, sales: dayTotal });
  }

  const weekTotal = chartData.reduce((s, d) => s + d.sales, 0);

  const stats = [
    { title: "Penjualan Hari Ini", value: formatCurrencyCompact(todaySales),  icon: DollarSign, color: "text-emerald-400", bg: "bg-emerald-400/10" },
    { title: "Pesanan Hari Ini",   value: String(todayOrders),          icon: ShoppingBag, color: "text-blue-400",    bg: "bg-blue-400/10" },
    { title: "Pesanan Aktif",      value: String(activeCount),           icon: Clock,       color: "text-amber-400",  bg: "bg-amber-400/10" },
    { title: "Pendapatan 7 Hari",  value: formatCurrencyCompact(weekTotal),    icon: TrendingUp,  color: "text-primary",    bg: "bg-primary/10" },
  ];

  const recentList = [...(recentOrders || [])]
    .filter(o => !o.is_void)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6);

  return (
    <div className="space-y-5 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Ringkasan performa toko hari ini.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((stat, i) => (
          <Card key={i} className="bg-card border-border hover:border-primary/30 transition-colors shadow-lg shadow-black/20">
            <CardContent className="p-4 md:p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                <h3 className="text-2xl md:text-3xl font-bold font-display text-foreground mt-1.5">{stat.value}</h3>
              </div>
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${stat.bg}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <Card className="lg:col-span-2 bg-card border-border shadow-lg shadow-black/20">
          <CardHeader>
            <CardTitle className="font-display">Ringkasan Pendapatan (7 Hari Terakhir)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] sm:h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} dy={8} />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={v => `Rp ${Number(v).toLocaleString('id-ID')}`}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted))" }}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }}
                    itemStyle={{ color: "hsl(var(--primary))" }}
                    formatter={(v: number) => [formatCurrency(v), "Penjualan"]}
                  />
                  <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-lg shadow-black/20">
          <CardHeader>
            <CardTitle className="font-display">Pesanan Terbaru</CardTitle>
          </CardHeader>
          <CardContent>
            {recentList.length > 0 ? (
              <div className="space-y-4 mt-1">
                {recentList.map(order => (
                  <div key={order.id} className="flex items-center justify-between border-b border-border/50 last:border-0 pb-3 last:pb-0">
                    <div>
                      <p className="font-medium text-sm text-foreground">{order.customer_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        #{order.id} · {format(new Date(order.created_at), "HH:mm")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-foreground">{formatCurrency(order.total)}</p>
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${STATUS_COLOR[order.status] ?? STATUS_COLOR.pending}`}>
                        {STATUS_ID[order.status] ?? order.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                Belum ada pesanan
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
