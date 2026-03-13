import {
  db,
  getPendingSyncItems,
  markSyncDone,
  markSyncFailed,
  getOrderItems,
} from '@/database/db';

/**
 * Convert an ISO date string to a Google Sheets / Excel serial date number.
 * Sheets stores dates as fractional days since 30 Dec 1899.
 * Sending this number — instead of a text string — lets GAS write it as a
 * real Date cell, which is sortable, filterable, and formattable in Sheets.
 *
 * Example: "2026-03-14T10:00:00.000Z" → 46124.416...
 * In GAS: format the column as "dd/mm/yyyy hh:mm" to display it properly.
 */
function toSheetDate(iso: string): number {
  const MS_PER_DAY = 86400000;
  const SHEET_EPOCH = Date.UTC(1899, 11, 30); // 1899-12-30
  return (new Date(iso).getTime() - SHEET_EPOCH) / MS_PER_DAY;
}

export const GAS_URL_KEY = 'pos_gas_endpoint_url';

export function getGasUrl(): string {
  return localStorage.getItem(GAS_URL_KEY) ?? '';
}

export function setGasUrl(url: string): void {
  localStorage.setItem(GAS_URL_KEY, url.trim());
}

export type SyncResult = {
  synced: number;
  failed: number;
  skipped: number;
};

/**
 * Sync all pending (and previously failed) orders to Google Sheets via GAS.
 *
 * Fix 1 — CORS: Use 'no-cors' + 'text/plain'. GAS Web Apps don't return CORS
 *   headers for POST requests, causing fetch() to throw even when the sheet
 *   received the data. With no-cors, data arrives and we optimistically mark done.
 *
 * Fix 2 — Retry: Also pick up 'failed' items, not just 'pending'.
 *
 * Fix 3 — Dates: Send dates as serial numbers so Sheets treats them as real
 *   Date cells (sortable, filterable) rather than plain text.
 */
export async function syncPendingOrders(gasUrl?: string): Promise<SyncResult> {
  const url = gasUrl ?? getGasUrl();
  const result: SyncResult = { synced: 0, failed: 0, skipped: 0 };

  if (!url) return result;

  const pending = await db.sync_queue
    .where('status')
    .anyOf(['pending', 'failed'])
    .toArray();

  if (pending.length === 0) return result;

  for (const syncItem of pending) {
    try {
      const order = await db.orders.get(syncItem.order_id);
      if (!order || order.is_void) {
        await markSyncDone(syncItem.order_id);
        result.skipped++;
        continue;
      }

      const items = await getOrderItems(syncItem.order_id);

      const rows = items.map(item => ({
        order_id:           order.id,
        order_date:         toSheetDate(order.created_at),     // serial number → real Date in Sheets
        ready_date:         order.ready_date
                              ? toSheetDate(order.ready_date)  // serial number → real Date in Sheets
                              : '',
        customer_name:      order.customer_name,
        customer_phone:     order.customer_phone ?? '',
        fulfillment_method: order.fulfillment_method === 'ojol' ? 'Ojol Delivery' : 'Pickup',
        delivery_address:   order.fulfillment_method === 'ojol' ? (order.delivery_address ?? '') : '',
        product_name:       item.product_name,
        qty:                item.qty,
        subtotal:           item.subtotal,
        total:              order.total,
        payment_method:     order.payment_method,
        status:             order.status,
        notes:              order.notes ?? '',
      }));

      await fetch(url, {
        method:  'POST',
        mode:    'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body:    JSON.stringify({ rows }),
      });

      await markSyncDone(syncItem.order_id);
      result.synced++;
    } catch {
      await markSyncFailed(syncItem.order_id);
      result.failed++;
    }
  }

  return result;
}

/**
 * Test the GAS URL with a ping — verifies the endpoint is reachable.
 */
export async function testGasConnection(url: string): Promise<boolean> {
  try {
    await fetch(url, {
      method:  'POST',
      mode:    'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body:    JSON.stringify({ ping: true, rows: [] }),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Auto-sync when the browser comes back online.
 */
export function startAutoSync(): () => void {
  const handleOnline = () => {
    const url = getGasUrl();
    if (url) syncPendingOrders(url).catch(() => {});
  };
  window.addEventListener('online', handleOnline);
  return () => window.removeEventListener('online', handleOnline);
}
