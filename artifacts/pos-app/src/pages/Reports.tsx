import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/database/db";
import { exportOrdersToExcel } from "@/services/exportService";
import { formatCurrency } from "@/utils/format";
import { Download, PieChart as PieChartIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  Tooltip as RechartsTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export default function Reports() {
  const orders = useLiveQuery(() => db.orders.toArray()) || [];
  const orderItems = useLiveQuery(() => db.order_items.toArray()) || [];

  const validOrders = orders.filter(o => !o.is_void);

  // Product sales from order_items
  const productSales: Record<string, number> = {};
  orderItems.forEach(item => {
    const order = orders.find(o => o.id === item.order_id);
    if (!order || order.is_void) return;
    productSales[item.product_name] = (productSales[item.product_name] || 0) + item.subtotal;
  });

  const pieData = Object.entries(productSales)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // Last 7 days bar chart
  const today = startOfDay(new Date());
  const dailyData = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(today, 6 - i);
    const label = format(d, "MMM dd");
    const dayTotal = validOrders
      .filter(o => format(new Date(o.created_at), "MMM dd") === label)
      .reduce((s, o) => s + o.total, 0);
    return { date: label, sales: dayTotal };
  });

  const totalAllTime = validOrders.reduce((s, o) => s + o.total, 0);
  const avgOrder = validOrders.length ? totalAllTime / validOrders.length : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground mt-1">Analytics and data exports.</p>
        </div>
        <Button onClick={exportOrdersToExcel} variant="outline" className="bg-card hover:bg-secondary border-border shadow-sm">
          <Download className="mr-2 h-4 w-4" /> Export to Excel
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "All-Time Revenue", value: formatCurrency(totalAllTime) },
          { label: "Total Orders", value: String(validOrders.length) },
          { label: "Average Order Value", value: formatCurrency(avgOrder) },
        ].map((s, i) => (
          <Card key={i} className="bg-card border-border shadow-lg shadow-black/10">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <h3 className="text-3xl font-bold font-display mt-2">{s.value}</h3>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Sales Bar Chart */}
        <Card className="bg-card border-border shadow-lg shadow-black/10">
          <CardHeader>
            <CardTitle className="font-display text-base">Daily Sales (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" fontSize={11} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} dy={6} />
                  <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                  <RechartsTooltip
                    formatter={(v: number) => [formatCurrency(v), "Sales"]}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }}
                    itemStyle={{ color: "hsl(var(--primary))" }}
                  />
                  <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Products Pie */}
        <Card className="bg-card border-border shadow-lg shadow-black/10">
          <CardHeader>
            <CardTitle className="font-display text-base flex items-center gap-2">
              <PieChartIcon size={17} className="text-primary" />
              Top Products by Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={4} dataKey="value" stroke="none">
                      {pieData.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(v: number) => formatCurrency(v)}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }}
                    />
                    <Legend verticalAlign="bottom" height={36} wrapperStyle={{ color: "hsl(var(--muted-foreground))", fontSize: "12px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
                No sales data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
