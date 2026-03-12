import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/database/db";
import { exportOrdersToExcel } from "@/services/exportService";
import { formatCurrency } from "@/utils/format";
import { Download, PieChart as PieChartIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

export default function Reports() {
  const orders = useLiveQuery(() => db.orders.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];

  // Generate category distribution data
  const categorySales: Record<string, number> = {};
  
  orders.forEach(order => {
    order.items.forEach(item => {
      // Find category for item
      const product = products.find(p => p.id === item.productId);
      const category = product ? product.category : 'Other';
      
      if (!categorySales[category]) {
        categorySales[category] = 0;
      }
      categorySales[category] += (item.price * item.quantity);
    });
  });

  const pieData = Object.entries(categorySales).map(([name, value]) => ({
    name, value
  })).sort((a,b) => b.value - a.value);

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  const handleExport = async () => {
    await exportOrdersToExcel();
  };

  const totalAllTime = orders.reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground mt-1">Analytics and data exports.</p>
        </div>
        <Button onClick={handleExport} variant="outline" className="bg-card hover:bg-secondary border-border shadow-sm">
          <Download className="mr-2 h-4 w-4" /> Export to Excel
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-card border-border shadow-lg shadow-black/20">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <PieChartIcon className="text-primary" size={20} />
              Sales by Category (All Time)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))'
                      }}
                    />
                    <Legend verticalAlign="bottom" height={36} wrapperStyle={{ color: 'hsl(var(--muted-foreground))' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
               <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                 Not enough data
               </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-card border-border shadow-lg shadow-black/20">
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground">All-Time Revenue</p>
              <h3 className="text-4xl font-bold font-display text-foreground mt-2">{formatCurrency(totalAllTime)}</h3>
              <p className="text-sm text-muted-foreground mt-2">Across {orders.length} total orders</p>
            </CardContent>
          </Card>
          
          <Card className="bg-card border-border shadow-lg shadow-black/20">
            <CardHeader>
              <CardTitle className="font-display text-lg">Top Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pieData.slice(0, 4).map((cat, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="font-medium text-foreground">{cat.name}</span>
                    <span className="font-bold text-primary">{formatCurrency(cat.value)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
