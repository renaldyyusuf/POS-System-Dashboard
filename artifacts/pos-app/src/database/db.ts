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
}

export class SmartPOSDatabase extends Dexie {
  products!: Table<Product, number>;
  orders!: Table<Order, number>;
  order_items!: Table<OrderItem, number>;
  sync_queue!: Table<SyncQueue, number>;

  constructor() {
    super('smartpos_db');
    this.version(1).stores({
      products: '++id, name, price, portion_size, created_at',
      orders: '++id, customer_name, customer_phone, created_at, ready_date, payment_method, total, status, fulfillment_method, is_void, is_synced',
      order_items: '++id, order_id, product_name, qty, price, subtotal',
      sync_queue: '++id, order_id, created_at, status',
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
