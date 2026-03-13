import * as XLSX from 'xlsx';
import { db, getOrderItems } from '@/database/db';
import { format, startOfDay, startOfMonth, subMonths } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

export async function exportFullReport() {
  const orders     = await db.orders.toArray();
  const allItems   = await db.order_items.toArray();
  const validOrders = orders.filter(o => !o.is_void);

  const workbook = XLSX.utils.book_new();

  // ── Sheet 1: Semua Pesanan ────────────────────────────────────────────────
  const orderRows: Record<string, unknown>[] = [];
  for (const order of orders) {
    const items = await getOrderItems(order.id!);
    orderRows.push({
      'No. Pesanan':        order.id,
      'Nama Customer':      order.customer_name,
      'No. Telepon':        order.customer_phone,
      'Tanggal Pesanan':    format(new Date(order.created_at), 'dd MMMM yyyy HH:mm', { locale: idLocale }),
      'Tanggal Siap':       order.ready_date ? format(new Date(order.ready_date), 'dd MMMM yyyy HH:mm', { locale: idLocale }) : '',
      'Status':             statusLabel(order.status),
      'Dibatalkan':         order.is_void ? 'Ya' : 'Tidak',
      'Metode Pembayaran':  order.payment_method,
      'Metode Pengambilan': order.fulfillment_method === 'ojol' ? 'Diantar (Ojol)' : 'Ambil Sendiri',
      'Alamat Pengiriman':  order.delivery_address || '',
      'Ongkos Kirim':       order.estimated_delivery_fee || 0,
      'Catatan':            order.notes || '',
      'Item':               items.map(i => `${i.qty}× ${i.product_name}`).join(', '),
      'Total':              order.total,
    });
  }
  const sheet1 = XLSX.utils.json_to_sheet(orderRows);
  sheet1['!cols'] = [
    { wch: 12 }, { wch: 22 }, { wch: 18 }, { wch: 22 }, { wch: 22 },
    { wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 30 },
    { wch: 14 }, { wch: 28 }, { wch: 40 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(workbook, sheet1, 'Semua Pesanan');

  // ── Sheet 2: Ringkasan Produk ─────────────────────────────────────────────
  const productMap: Record<string, { qty: number; revenue: number }> = {};
  for (const item of allItems) {
    const order = orders.find(o => o.id === item.order_id);
    if (!order || order.is_void) continue;
    if (!productMap[item.product_name]) productMap[item.product_name] = { qty: 0, revenue: 0 };
    productMap[item.product_name].qty     += item.qty;
    productMap[item.product_name].revenue += item.subtotal;
  }
  const productRows = Object.entries(productMap)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .map(([name, d], i) => ({
      'Peringkat':           i + 1,
      'Nama Produk':         name,
      'Total Terjual (Qty)': d.qty,
      'Total Pendapatan':    d.revenue,
      'Harga Rata-rata':     d.qty > 0 ? +(d.revenue / d.qty).toFixed(0) : 0,
    }));
  const sheet2 = XLSX.utils.json_to_sheet(productRows);
  sheet2['!cols'] = [{ wch: 10 }, { wch: 28 }, { wch: 18 }, { wch: 18 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(workbook, sheet2, 'Ringkasan Produk');

  // ── Sheet 3: Penjualan Harian (30 hari) ───────────────────────────────────
  const today = startOfDay(new Date());
  const dailyRows: Record<string, unknown>[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key       = format(d, 'yyyy-MM-dd');
    const labelDate = format(d, 'dd MMMM yyyy', { locale: idLocale });
    const dayOrders = validOrders.filter(o => format(new Date(o.created_at), 'yyyy-MM-dd') === key);
    dailyRows.push({
      'Tanggal':          labelDate,
      'Jumlah Pesanan':   dayOrders.length,
      'Total Pendapatan': dayOrders.reduce((s, o) => s + o.total, 0),
    });
  }
  const sheet3 = XLSX.utils.json_to_sheet(dailyRows);
  sheet3['!cols'] = [{ wch: 20 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(workbook, sheet3, 'Penjualan Harian (30h)');

  // ── Sheet 4: Penjualan Bulanan (12 bulan) ────────────────────────────────
  const monthlyRows: Record<string, unknown>[] = [];
  for (let i = 11; i >= 0; i--) {
    const m     = startOfMonth(subMonths(new Date(), i));
    const key   = format(m, 'yyyy-MM');
    const label = format(m, 'MMMM yyyy', { locale: idLocale });
    const monthOrders = validOrders.filter(o => format(new Date(o.created_at), 'yyyy-MM') === key);
    monthlyRows.push({
      'Bulan':             label,
      'Jumlah Pesanan':    monthOrders.length,
      'Total Pendapatan':  monthOrders.reduce((s, o) => s + o.total, 0),
    });
  }
  const sheet4 = XLSX.utils.json_to_sheet(monthlyRows);
  sheet4['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(workbook, sheet4, 'Penjualan Bulanan');

  XLSX.writeFile(workbook, `LuminaPOS_Laporan_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending:       'Menunggu',
    'in-progress': 'Diproses',
    ready:         'Siap',
    delivered:     'Selesai',
  };
  return map[status] ?? status;
}

export const exportOrdersToExcel = exportFullReport;
