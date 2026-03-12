import {
  db,
  getPendingSyncItems,
  markSyncDone,
  markSyncFailed,
  getOrderItems,
} from '@/database/db';
import { format } from 'date-fns';

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
 * Sync all pending orders to Google Sheets via a GAS Web App endpoint.
 * Each order item is sent as a separate row.
 */
export async function syncPendingOrders(gasUrl?: string): Promise<SyncResult> {
  const url = gasUrl ?? getGasUrl();
  const result: SyncResult = { synced: 0, failed: 0, skipped: 0 };

  if (!url) return result;

  const pending = await getPendingSyncItems();
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
        order_id: order.id,
        order_date: format(new Date(order.created_at), 'yyyy-MM-dd HH:mm'),
        ready_date: order.ready_date
          ? format(new Date(order.ready_date), 'yyyy-MM-dd HH:mm')
          : '',
        customer_name: order.customer_name,
        customer_phone: order.customer_phone ?? '',
        fulfillment_method: order.fulfillment_method === 'ojol' ? 'Ojol Delivery' : 'Pickup',
        delivery_address: order.fulfillment_method === 'ojol' ? (order.delivery_address ?? '') : '',
        product_name: item.product_name,
        qty: item.qty,
        subtotal: item.subtotal,
        total: order.total,
        payment_method: order.payment_method,
        status: order.status,
        notes: order.notes ?? '',
      }));

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

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
 * Start listening for online events and auto-sync when connection is restored.
 */
export function startAutoSync(): () => void {
  const handleOnline = () => {
    const url = getGasUrl();
    if (url) syncPendingOrders(url).catch(() => {});
  };
  window.addEventListener('online', handleOnline);
  return () => window.removeEventListener('online', handleOnline);
}
