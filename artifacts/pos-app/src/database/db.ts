import Dexie, { type Table } from 'dexie';

export interface Product {
  id?: number;
  name: string;
  price: number;
  portion_size: string;
  created_at: string;
}

export interface Order {
  id?: number;
  customer_name: string;
  customer_phone: string;
  created_at: string;
  ready_date: string;
  payment_method: string;
  total: number;
  status: string;
  fulfillment_method: string;
  delivery_address: string;
  delivery_notes: string;
  estimated_delivery_fee: number;
  notes: string;
  is_void: boolean;
  is_synced: boolean;
}

export interface OrderItem {
  id?: number;
  order_id: number;
  product_name: string;
  qty: number;
  price: number;
  subtotal: number;
}

export interface SyncQueue {
  id?: number;
  order_id: number;
  created_at: string;
  status: string;
  action?: 'insert' | 'update'; // 'update' = edit existing, triggers delete+rewrite in GAS
}

export interface StoreSettings {
  id?: number;
  store_name: string;
  phone_number: string;
  store_address: string;
  bank_name: string;
  bank_account_number: string;
  bank_account_holder: string;
  additional_notes: string;
  bank_accounts: string; // JSON: BankAccount[]
  qris_image: string;   // base64 data URL of the QRIS image
  created_at: string;
  updated_at: string;
}

export class SmartPOSDatabase extends Dexie {
  products!: Table<Product, number>;
  orders!: Table<Order, number>;
  order_items!: Table<OrderItem, number>;
  sync_queue!: Table<SyncQueue, number>;
  store_settings!: Table<StoreSettings, number>;

  constructor() {
    super('smartpos_db');
    this.version(1).stores({
      products: '++id, name, price, portion_size, created_at',
      orders: '++id, customer_name, customer_phone, created_at, ready_date, payment_method, total, status, fulfillment_method, is_void, is_synced',
      order_items: '++id, order_id, product_name, qty, price, subtotal',
      sync_queue: '++id, order_id, created_at, status',
    });
    this.version(2).stores({
      products: '++id, name, price, portion_size, created_at',
      orders: '++id, customer_name, customer_phone, created_at, ready_date, payment_method, total, status, fulfillment_method, is_void, is_synced',
      order_items: '++id, order_id, product_name, qty, price, subtotal',
      sync_queue: '++id, order_id, created_at, status',
      store_settings: '++id',
    });
    this.version(3).stores({
      products: '++id, name, price, portion_size, created_at',
      orders: '++id, customer_name, customer_phone, created_at, ready_date, payment_method, total, status, fulfillment_method, is_void, is_synced',
      order_items: '++id, order_id, product_name, qty, price, subtotal',
      sync_queue: '++id, order_id, created_at, status',
      store_settings: '++id',
    }).upgrade(tx => {
      // Migrate existing single bank account into the new bank_accounts array
      return tx.table('store_settings').toCollection().modify((s: any) => {
        if (!s.bank_accounts) {
          const legacy = [];
          if (s.bank_name || s.bank_account_number || s.bank_account_holder) {
            legacy.push({
              id: crypto.randomUUID(),
              bank_name: s.bank_name ?? '',
              account_number: s.bank_account_number ?? '',
              account_holder: s.bank_account_holder ?? '',
            });
          }
          s.bank_accounts = JSON.stringify(legacy);
        }
      });
    });
    this.version(4).stores({
      products: '++id, name, price, portion_size, created_at',
      orders: '++id, customer_name, customer_phone, created_at, ready_date, payment_method, total, status, fulfillment_method, is_void, is_synced',
      order_items: '++id, order_id, product_name, qty, price, subtotal',
      sync_queue: '++id, order_id, created_at, status',
      store_settings: '++id',
    }).upgrade(tx => {
      return tx.table('store_settings').toCollection().modify((s: any) => {
        if (!s.qris_image) s.qris_image = '';
      });
    });
    this.version(5).stores({
      products: '++id, name, price, portion_size, created_at',
      orders: '++id, customer_name, customer_phone, created_at, ready_date, payment_method, total, status, fulfillment_method, is_void, is_synced',
      order_items: '++id, order_id, product_name, qty, price, subtotal',
      sync_queue: '++id, order_id, created_at, status',
      store_settings: '++id',
    }).upgrade(tx => {
      return tx.table('store_settings').toCollection().modify((s: any) => {
        if (s.maps_url === undefined) s.maps_url = '';
      });
    });
  }
}

export const db = new SmartPOSDatabase();

// ─── Products ────────────────────────────────────────────────────────────────

export async function addProduct(data: Omit<Product, 'id' | 'created_at'>): Promise<number> {
  return db.products.add({
    ...data,
    created_at: new Date().toISOString(),
  });
}

export async function updateProduct(id: number, data: Partial<Omit<Product, 'id' | 'created_at'>>): Promise<void> {
  await db.products.update(id, data);
}

export async function deleteProduct(id: number): Promise<void> {
  await db.products.delete(id);
}

export async function getProducts(): Promise<Product[]> {
  return db.products.toArray();
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export async function createOrder(data: Omit<Order, 'id' | 'created_at' | 'is_void' | 'is_synced'>): Promise<number> {
  return db.orders.add({
    ...data,
    created_at: new Date().toISOString(),
    is_void: false,
    is_synced: false,
  });
}

export async function saveOrderItems(items: Omit<OrderItem, 'id'>[]): Promise<void> {
  await db.order_items.bulkAdd(items);
}

export async function getOrders(): Promise<Order[]> {
  return db.orders.orderBy('created_at').reverse().toArray();
}

export async function updateOrderStatus(id: number, status: string): Promise<void> {
  await db.orders.update(id, { status });
}

export async function getOrderItems(order_id: number): Promise<OrderItem[]> {
  return db.order_items.where('order_id').equals(order_id).toArray();
}

export async function voidOrder(id: number): Promise<void> {
  await db.orders.update(id, { is_void: true });
}

export async function getOrderById(id: number): Promise<Order | undefined> {
  return db.orders.get(id);
}

export async function updateOrder(id: number, data: Partial<Omit<Order, 'id' | 'created_at' | 'is_synced'>>): Promise<void> {
  await db.orders.update(id, data);
}

/**
 * Replace all items for an order and recalculate total.
 * Used when editing order items — deletes old rows and inserts new ones.
 */
export async function replaceOrderItems(
  order_id: number,
  items: Omit<OrderItem, 'id'>[],
): Promise<void> {
  const total = items.reduce((s, i) => s + i.subtotal, 0);
  await db.transaction('rw', db.order_items, db.orders, async () => {
    await db.order_items.where('order_id').equals(order_id).delete();
    if (items.length > 0) await db.order_items.bulkAdd(items);
    await db.orders.update(order_id, { total, is_synced: false });
  });
}

/**
 * Re-queue an already-synced order for re-sync (after editing).
 * Resets or creates a sync_queue entry so the order will be re-sent as an update.
 */
export async function requeueOrderSync(order_id: number): Promise<void> {
  const existing = await db.sync_queue.where('order_id').equals(order_id).first();
  if (existing) {
    await db.sync_queue.where('order_id').equals(order_id).modify({ status: 'pending', action: 'update' });
  } else {
    await db.sync_queue.add({ order_id, created_at: new Date().toISOString(), status: 'pending', action: 'update' });
  }
  await db.orders.update(order_id, { is_synced: false });
}

// ─── Sync Queue ───────────────────────────────────────────────────────────────

export async function addToSyncQueue(order_id: number): Promise<void> {
  const existing = await db.sync_queue.where('order_id').equals(order_id).first();
  if (!existing) {
    await db.sync_queue.add({ order_id, created_at: new Date().toISOString(), status: 'pending' });
  }
}

export async function getPendingSyncItems(): Promise<SyncQueue[]> {
  return db.sync_queue.where('status').equals('pending').toArray();
}

export async function markSyncDone(order_id: number): Promise<void> {
  await db.orders.update(order_id, { is_synced: true });
  await db.sync_queue.where('order_id').equals(order_id).modify({ status: 'done' });
}

export async function markSyncFailed(order_id: number): Promise<void> {
  await db.sync_queue.where('order_id').equals(order_id).modify({ status: 'failed' });
}

export async function getPendingSyncCount(): Promise<number> {
  return db.sync_queue.where('status').equals('pending').count();
}
