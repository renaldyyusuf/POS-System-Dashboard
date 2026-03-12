import * as XLSX from 'xlsx';
import { db } from '@/database/db';

export async function exportOrdersToExcel() {
  const orders = await db.orders.toArray();
  
  const flattenedData = orders.map(order => ({
    'Order ID': order.id,
    'Order Number': order.orderNumber,
    'Date': new Date(order.createdAt).toLocaleDateString(),
    'Time': new Date(order.createdAt).toLocaleTimeString(),
    'Status': order.status,
    'Payment Method': order.paymentMethod,
    'Subtotal': order.subtotal,
    'Tax': order.tax,
    'Total': order.total,
    'Items Count': order.items.reduce((sum, item) => sum + item.quantity, 0),
    'Items Detail': order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')
  }));

  const worksheet = XLSX.utils.json_to_sheet(flattenedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");
  
  XLSX.writeFile(workbook, `POS_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
}
