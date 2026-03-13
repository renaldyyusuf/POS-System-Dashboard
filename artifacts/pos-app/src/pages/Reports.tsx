import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/database/db";
import { exportFullReport } from "@/services/exportService";
import { formatCurrency, formatCurrencyCompact } from "@/utils/format";
import {
  Download, TrendingUp, TrendingDown, Lightbulb,
  Clock, ShoppingCart, Flame, Zap, Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from "recharts";
import {
  format, subDays, startOfDay, startOfMonth, subMonths,
} from "date-fns";
import { useState } from "react";

// ── Colors ─────────────────────────────────────────────────────────────────

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  borderColor: "hsl(var(--border))",
  borderRadius: "10px",
  color: "hsl(var(--foreground))",
  fontSize: "12px",
};

// ── Tiny stat card ─────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <Card className="bg-card border-border shadow-lg shadow-black/10">
      <CardContent className="p-5 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold font-display mt-1 truncate">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Insight card ───────────────────────────────────────────────────────────

function InsightCard({
  icon, label, value, sub, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className={`flex items-start gap-3 p-3.5 rounded-xl border ${color}`}>
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-sm font-bold text-foreground truncate mt-0.5">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function Reports() {
  const [isExporting, setIsExporting] = useState(false);

  const orders    = useLiveQuery(() => db.orders.toArray())     ?? [];
  const orderItems = useLiveQuery(() => db.order_items.toArray()) ?? [];

  const validOrders = orders.filter(o => !o.is_void);

  // ── Date helpers ──────────────────────────────────────────────────────────

  const todayStr  = format(new Date(), "yyyy-MM-dd");
  const monthStr  = format(new Date(), "yyyy-MM");

  const todayOrders = validOrders.filter(o => format(new Date(o.created_at), "yyyy-MM-dd") === todayStr);
  const monthOrders = validOrders.filter(o => format(new Date(o.created_at), "yyyy-MM") === monthStr);

  const dailyTotal   = todayOrders.reduce((s, o) => s + o.total, 0);
  const monthlyTotal = monthOrders.reduce((s, o) => s + o.total, 0);
  const allTimeTotal = validOrders.reduce((s, o) => s + o.total, 0);
  const avgOrder     = validOrders.length ? allTimeTotal / validOrders.length : 0;

  // ── Daily bar data (last 7 days) ──────────────────────────────────────────

  const dailyBarData = Array.from({ length: 7 }, (_, i) => {
    const d   = subDays(startOfDay(new Date()), 6 - i);
    const key = format(d, "yyyy-MM-dd");
    const lbl = format(d, "EEE");
    const total = validOrders
      .filter(o => format(new Date(o.created_at), "yyyy-MM-dd") === key)
      .reduce((s, o) => s + o.total, 0);
    return { day: lbl, sales: total };
  });

  // ── Monthly bar data (last 6 months) ─────────────────────────────────────

  const monthlyBarData = Array.from({ length: 6 }, (_, i) => {
    const m   = startOfMonth(subMonths(new Date(), 5 - i));
    const key = format(m, "yyyy-MM");
    const lbl = format(m, "MMM");
    const total = validOrders
      .filter(o => format(new Date(o.created_at), "yyyy-MM") === key)
      .reduce((s, o) => s + o.total, 0);
    return { month: lbl, sales: total };
  });

  // ── Product sales aggregation ─────────────────────────────────────────────

  const productMap: Record<string, { qty: number; revenue: number }> = {};
  orderItems.forEach(item => {
    const order = orders.find(o => o.id === item.order_id);
    if (!order || order.is_void) return;
    if (!productMap[item.product_name]) productMap[item.product_name] = { qty: 0, revenue: 0 };
    productMap[item.product_name].qty     += item.qty;
    productMap[item.product_name].revenue += item.subtotal;
  });

  const productList = Object.entries(productMap)
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.revenue - a.revenue);

  const topProducts  = productList.slice(0, 5);
  const slowProducts = [...productList].sort((a, b) => a.qty - b.qty).slice(0, 5);

  // ── Insights ──────────────────────────────────────────────────────────────

  // Top selling product today
  const todayItemMap: Record<string, number> = {};
  orderItems.forEach(item => {
    const order = orders.find(o => o.id === item.order_id);
    if (!order || order.is_void) return;
    if (format(new Date(order.created_at), "yyyy-MM-dd") !== todayStr) return;
    todayItemMap[item.product_name] = (todayItemMap[item.product_name] || 0) + item.qty;
  });
  const topToday = Object.entries(todayItemMap).sort((a, b) => b[1] - a[1])[0];

  // Busiest order hour
  const hourCount: Record<number, number> = {};
  validOrders.forEach(o => {
    const h = new Date(o.created_at).getHours();
    hourCount[h] = (hourCount[h] || 0) + 1;
  });
  const busiestHourEntry = Object.entries(hourCount).sort((a, b) => b[1] - a[1])[0];
  const busiestHour = busiestHourEntry
    ? (() => {
        const h = parseInt(busiestHourEntry[0]);
        const suffix = h >= 12 ? "PM" : "AM";
        const h12 = h % 12 || 12;
        return { label: `${h12}:00 ${suffix}`, count: busiestHourEntry[1] };
      })()
    : null;

  // Products often bought together (co-occurrence analysis)
  const pairMap: Record<string, number> = {};
  const ordersByOrder: Record<number, string[]> = {};
  orderItems.forEach(item => {
    const order = orders.find(o => o.id === item.order_id);
    if (!order || order.is_void) return;
    if (!ordersByOrder[item.order_id]) ordersByOrder[item.order_id] = [];
    ordersByOrder[item.order_id].push(item.product_name);
  });
  Object.values(ordersByOrder).forEach(names => {
    const unique = [...new Set(names)];
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        const key = [unique[i], unique[j]].sort().join(" + ");
        pairMap[key] = (pairMap[key] || 0) + 1;
      }
    }
  });
  const topPair = Object.entries(pairMap).sort((a, b) => b[1] - a[1])[0];

  // ── Horizontal product sales bar chart data ───────────────────────────────

  const productBarData = topProducts.map(p => ({
    name: p.name.length > 18 ? p.name.slice(0, 16) + "…" : p.name,
    fullName: p.name,
    revenue: p.revenue,
    qty: p.qty,
  }));

  // ── Handle export ─────────────────────────────────────────────────────────

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportFullReport();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground mt-1">Sales analytics, product performance, and insights.</p>
        </div>
        <Button
          onClick={handleExport}
          disabled={isExporting}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md shadow-emerald-900/30"
        >
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? "Exporting…" : "Export to Excel"}
        </Button>
      </div>

      {/* ── Stat Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Today's Sales"
          value={formatCurrency(dailyTotal)}
          sub={`${todayOrders.length} order${todayOrders.length !== 1 ? "s" : ""} today`}
          icon={<TrendingUp size={18} className="text-emerald-400" />}
          accent="bg-emerald-500/10"
        />
        <StatCard
          label="This Month"
          value={formatCurrency(monthlyTotal)}
          sub={`${monthOrders.length} orders in ${format(new Date(), "MMMM")}`}
          icon={<ShoppingCart size={18} className="text-blue-400" />}
          accent="bg-blue-500/10"
        />
        <StatCard
          label="All-Time Revenue"
          value={formatCurrency(allTimeTotal)}
          sub={`${validOrders.length} total orders`}
          icon={<Zap size={18} className="text-primary" />}
          accent="bg-primary/10"
        />
        <StatCard
          label="Avg Order Value"
          value={formatCurrency(avgOrder)}
          sub="across all orders"
          icon={<Package size={18} className="text-amber-400" />}
          accent="bg-amber-500/10"
        />
      </div>

      {/* ── Charts Row 1: Daily + Monthly ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Daily Sales */}
        <Card className="bg-card border-border shadow-lg shadow-black/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp size={15} className="text-primary" /> Daily Sales — Last 7 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyBarData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="day" fontSize={11} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                  <RechartsTooltip
                    formatter={(v: number) => [formatCurrency(v), "Sales"]}
                    contentStyle={tooltipStyle}
                    itemStyle={{ color: "hsl(var(--primary))" }}
                    cursor={{ fill: "hsl(var(--secondary))", opacity: 0.4 }}
                  />
                  <Bar dataKey="sales" radius={[5, 5, 0, 0]} maxBarSize={44}>
                    {dailyBarData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.day === format(new Date(), "EEE") ? "hsl(var(--primary))" : "hsl(var(--chart-1))"}
                        opacity={entry.day === format(new Date(), "EEE") ? 1 : 0.6}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Sales */}
        <Card className="bg-card border-border shadow-lg shadow-black/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp size={15} className="text-blue-400" /> Monthly Sales — Last 6 Months
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyBarData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" fontSize={11} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                  <RechartsTooltip
                    formatter={(v: number) => [formatCurrency(v), "Sales"]}
                    contentStyle={tooltipStyle}
                    itemStyle={{ color: "hsl(var(--chart-2))" }}
                    cursor={{ fill: "hsl(var(--secondary))", opacity: 0.4 }}
                  />
                  <Bar dataKey="sales" fill="hsl(var(--chart-2))" radius={[5, 5, 0, 0]} maxBarSize={44} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Charts Row 2: Product Sales ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Product Sales Horizontal Bar */}
        <Card className="bg-card border-border shadow-lg shadow-black/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Flame size={15} className="text-amber-400" /> Sales per Product (Revenue)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {productBarData.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                No sales data yet
              </div>
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={productBarData}
                    margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis
                      type="number"
                      fontSize={11}
                      stroke="hsl(var(--muted-foreground))"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={v => `$${v}`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      fontSize={11}
                      stroke="hsl(var(--muted-foreground))"
                      tickLine={false}
                      axisLine={false}
                      width={100}
                    />
                    <RechartsTooltip
                      formatter={(v: number) => [formatCurrency(v), "Revenue"]}
                      labelFormatter={(label, payload) =>
                        payload?.[0]?.payload?.fullName ?? label
                      }
                      contentStyle={tooltipStyle}
                      itemStyle={{ color: "hsl(var(--chart-3))" }}
                      cursor={{ fill: "hsl(var(--secondary))", opacity: 0.4 }}
                    />
                    <Bar dataKey="revenue" radius={[0, 5, 5, 0]} maxBarSize={28}>
                      {productBarData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Product Share Pie */}
        <Card className="bg-card border-border shadow-lg shadow-black/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Package size={15} className="text-primary" /> Revenue Share by Product
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                No sales data yet
              </div>
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={topProducts}
                      dataKey="revenue"
                      nameKey="name"
                      cx="50%"
                      cy="45%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {topProducts.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(v: number) => [formatCurrency(v), "Revenue"]}
                      contentStyle={tooltipStyle}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={30}
                      wrapperStyle={{ color: "hsl(var(--muted-foreground))", fontSize: "11px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Tables + Insights Row ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Top Selling Products */}
        <Card className="bg-card border-border shadow-lg shadow-black/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp size={14} className="text-emerald-400" /> Top Selling Products
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-0">
            {topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No data yet</p>
            ) : (
              topProducts.map((p, i) => (
                <div key={p.name}>
                  <div className="flex items-center justify-between py-2.5 gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`text-xs font-bold w-5 text-right shrink-0 ${
                        i === 0 ? "text-amber-400" : i === 1 ? "text-slate-400" : "text-muted-foreground"
                      }`}>
                        #{i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.qty} sold</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-primary tabular-nums shrink-0">
                      {formatCurrency(p.revenue)}
                    </span>
                  </div>
                  {i < topProducts.length - 1 && <Separator className="opacity-50" />}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Slow Moving Products */}
        <Card className="bg-card border-border shadow-lg shadow-black/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingDown size={14} className="text-destructive" /> Slow Moving Products
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-0">
            {slowProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No data yet</p>
            ) : (
              slowProducts.map((p, i) => (
                <div key={p.name}>
                  <div className="flex items-center justify-between py-2.5 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.qty} sold</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-medium text-muted-foreground tabular-nums">
                        {formatCurrency(p.revenue)}
                      </span>
                      <div className="w-16 h-1.5 bg-secondary rounded-full mt-1 overflow-hidden">
                        <div
                          className="h-full bg-destructive/60 rounded-full"
                          style={{
                            width: `${Math.max(5, (p.qty / (topProducts[0]?.qty || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  {i < slowProducts.length - 1 && <Separator className="opacity-50" />}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* AI Insights */}
        <Card className="bg-card border-border shadow-lg shadow-black/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Lightbulb size={14} className="text-amber-400" /> Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2.5">
            <InsightCard
              icon={<Flame size={14} className="text-orange-400" />}
              label="Top selling today"
              value={topToday ? `${topToday[0]}` : "No orders today"}
              sub={topToday ? `${topToday[1]} sold today` : "Place some orders to see insights"}
              color="border-orange-500/20 bg-orange-500/5"
            />
            <InsightCard
              icon={<Clock size={14} className="text-blue-400" />}
              label="Busiest order hour"
              value={busiestHour ? busiestHour.label : "Not enough data"}
              sub={busiestHour ? `${busiestHour.count} order${busiestHour.count !== 1 ? "s" : ""} on average` : undefined}
              color="border-blue-500/20 bg-blue-500/5"
            />
            <InsightCard
              icon={<ShoppingCart size={14} className="text-emerald-400" />}
              label="Often bought together"
              value={topPair ? topPair[0] : "Not enough data"}
              sub={topPair ? `Ordered together ${topPair[1]} time${topPair[1] !== 1 ? "s" : ""}` : "Need more multi-item orders"}
              color="border-emerald-500/20 bg-emerald-500/5"
            />

            <Separator className="opacity-50" />

            <div className="pt-1 space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Pickup orders</span>
                <span className="font-semibold text-foreground">
                  {validOrders.filter(o => o.fulfillment_method === "pickup").length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Ojol orders</span>
                <span className="font-semibold text-foreground">
                  {validOrders.filter(o => o.fulfillment_method === "ojol").length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Transfer payments</span>
                <span className="font-semibold text-foreground">
                  {validOrders.filter(o => o.payment_method === "Transfer").length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>QRIS payments</span>
                <span className="font-semibold text-foreground">
                  {validOrders.filter(o => o.payment_method === "QRIS").length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
