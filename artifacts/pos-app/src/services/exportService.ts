import * as XLSX from 'xlsx';
import { db, getOrderItems } from '@/database/db';
import { format, startOfDay, startOfMonth, subMonths } from 'date-fns';

export async function exportFullReport() {
  const orders = await db.orders.toArray();
  const allItems = await db.order_items.toArray();
  const validOrders = orders.filter(o => !o.is_void);

  const workbook = XLSX.utils.book_new();

  // ── Sheet 1: All Orders ───────────────────────────────────────────────────
  const orderRows: Record<string, unknown>[] = [];
  for (const order of orders) {
    const items = await getOrderItems(order.id!);
    orderRows.push({
      'Order ID': order.id,
      'Customer Name': order.customer_name,
      'Customer Phone': order.customer_phone,
      'Created At': format(new Date(order.created_at), 'yyyy-MM-dd HH:mm'),
      'Ready Date': order.ready_date ? format(new Date(order.ready_date), 'yyyy-MM-dd HH:mm') : '',
      'Status': order.status,
      'Void': order.is_void ? 'Yes' : 'No',
      'Payment Method': order.payment_method,
      'Fulfillment': order.fulfillment_method === 'ojol' ? 'Ojol Delivery' : 'Pickup',
      'Delivery Address': order.delivery_address || '',
      'Delivery Fee': order.estimated_delivery_fee || 0,
      'Notes': order.notes || '',
      'Items': items.map(i => `${i.qty}× ${i.product_name}`).join(', '),
      'Total': order.total,
    });
  }
  const sheet1 = XLSX.utils.json_to_sheet(orderRows);
  sheet1['!cols'] = [
    { wch: 10 }, { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
    { wch: 12 }, { wch: 6 }, { wch: 14 }, { wch: 14 }, { wch: 30 },
    { wch: 14 }, { wch: 25 }, { wch: 40 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(workbook, sheet1, 'All Orders');

  // ── Sheet 2: Product Sales Summary ────────────────────────────────────────
  const productMap: Record<string, { qty: number; revenue: number }> = {};
  for (const item of allItems) {
    const order = orders.find(o => o.id === item.order_id);
    if (!order || order.is_void) continue;
    if (!productMap[item.product_name]) productMap[item.product_name] = { qty: 0, revenue: 0 };
    productMap[item.product_name].qty += item.qty;
    productMap[item.product_name].revenue += item.subtotal;
  }
  const productRows = Object.entries(productMap)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .map(([name, d], i) => ({
      'Rank': i + 1,
      'Product Name': name,
      'Total Qty Sold': d.qty,
      'Total Revenue': d.revenue,
      'Avg Price Per Unit': d.qty > 0 ? +(d.revenue / d.qty).toFixed(2) : 0,
    }));
  const sheet2 = XLSX.utils.json_to_sheet(productRows);
  sheet2['!cols'] = [{ wch: 6 }, { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, sheet2, 'Product Summary');

  // ── Sheet 3: Daily Sales (Last 30 days) ───────────────────────────────────
  const today = startOfDay(new Date());
  const dailyRows: Record<string, unknown>[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = format(d, 'yyyy-MM-dd');
    const dayOrders = validOrders.filter(o => format(new Date(o.created_at), 'yyyy-MM-dd') === key);
    dailyRows.push({
      'Date': key,
      'Orders': dayOrders.length,
      'Revenue': dayOrders.reduce((s, o) => s + o.total, 0),
    });
  }
  const sheet3 = XLSX.utils.json_to_sheet(dailyRows);
  sheet3['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(workbook, sheet3, 'Daily Sales (30d)');

  // ── Sheet 4: Monthly Sales (Last 12 months) ───────────────────────────────
  const monthlyRows: Record<string, unknown>[] = [];
  for (let i = 11; i >= 0; i--) {
    const m = startOfMonth(subMonths(new Date(), i));
    const key = format(m, 'yyyy-MM');
    const label = format(m, 'MMM yyyy');
    const monthOrders = validOrders.filter(o => format(new Date(o.created_at), 'yyyy-MM') === key);
    monthlyRows.push({
      'Month': label,
      'Orders': monthOrders.length,
      'Revenue': monthOrders.reduce((s, o) => s + o.total, 0),
    });
  }
  const sheet4 = XLSX.utils.json_to_sheet(monthlyRows);
  sheet4['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(workbook, sheet4, 'Monthly Sales');

  XLSX.writeFile(workbook, `SmartPOS_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}

// keep old export name so nothing else breaks
export const exportOrdersToExcel = exportFullReport;
