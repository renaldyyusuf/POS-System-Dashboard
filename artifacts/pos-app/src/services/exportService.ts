import * as XLSX from 'xlsx';
import { db, getOrderItems } from '@/database/db';

export async function exportOrdersToExcel() {
  const orders = await db.orders.toArray();

  const rows: Record<string, unknown>[] = [];

  for (const order of orders) {
    const items = await getOrderItems(order.id!);
    rows.push({
      'Order ID': order.id,
      'Customer Name': order.customer_name,
      'Customer Phone': order.customer_phone,
      'Date': new Date(order.created_at).toLocaleDateString(),
      'Time': new Date(order.created_at).toLocaleTimeString(),
      'Status': order.status,
      'Payment Method': order.payment_method,
      'Fulfillment': order.fulfillment_method,
      'Delivery Address': order.delivery_address,
      'Delivery Notes': order.delivery_notes,
      'Est. Delivery Fee': order.estimated_delivery_fee,
      'Notes': order.notes,
      'Total': order.total,
      'Void': order.is_void ? 'Yes' : 'No',
      'Items': items.map(i => `${i.qty}x ${i.product_name}`).join(', '),
    });
  }

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');
  XLSX.writeFile(workbook, `SmartPOS_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
}
