// ─── Firestore Database Layer ─────────────────────────────────────────────────
// Replaces the old Dexie/IndexedDB implementation.
// All data is now stored in Firebase Firestore — accessible from any device.

import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, getDoc, query, orderBy, where,
  onSnapshot, writeBatch, serverTimestamp,
  type Unsubscribe, Timestamp,
} from "firebase/firestore";
import { db } from "@/database/firebase";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Product {
  id?: string;
  name: string;
  price: number;
  portion_size: string;
  created_at: string;
}

export interface Order {
  id?: string;
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
  id?: string;
  order_id: string;
  product_name: string;
  qty: number;
  price: number;
  subtotal: number;
}

export interface SyncQueue {
  id?: string;
  order_id: string;
  created_at: string;
  status: string;
  action?: 'insert' | 'update';
}

export interface StoreSettings {
  id?: string;
  store_name: string;
  phone_number: string;
  store_address: string;
  maps_url: string;
  bank_name: string;
  bank_account_number: string;
  bank_account_holder: string;
  additional_notes: string;
  bank_accounts: string;
  qris_image: string;
  created_at: string;
  updated_at: string;
}

// ─── Collection refs ─────────────────────────────────────────────────────────

const productsCol    = () => collection(db, "products");
const ordersCol      = () => collection(db, "orders");
const orderItemsCol  = () => collection(db, "order_items");
const syncQueueCol   = () => collection(db, "sync_queue");
const settingsCol    = () => collection(db, "store_settings");

// ─── Helper: strip undefined fields (Firestore rejects them) ─────────────────

function clean<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T;
}

// ─── Products ────────────────────────────────────────────────────────────────

export async function addProduct(data: Omit<Product, 'id' | 'created_at'>): Promise<string> {
  const ref = await addDoc(productsCol(), clean({
    ...data,
    created_at: new Date().toISOString(),
  }));
  return ref.id;
}

export async function updateProduct(id: string, data: Partial<Omit<Product, 'id' | 'created_at'>>): Promise<void> {
  await updateDoc(doc(db, "products", id), clean(data));
}

export async function deleteProduct(id: string): Promise<void> {
  await deleteDoc(doc(db, "products", id));
}

export async function getProducts(): Promise<Product[]> {
  const snap = await getDocs(query(productsCol(), orderBy("created_at", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
}

export function onProductsSnapshot(cb: (products: Product[]) => void): Unsubscribe {
  return onSnapshot(query(productsCol(), orderBy("created_at", "desc")), snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
  });
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export async function createOrder(data: Omit<Order, 'id' | 'created_at' | 'is_void' | 'is_synced'>): Promise<string> {
  const ref = await addDoc(ordersCol(), clean({
    ...data,
    created_at: new Date().toISOString(),
    is_void: false,
    is_synced: false,
  }));
  return ref.id;
}

export async function getOrders(): Promise<Order[]> {
  const snap = await getDocs(query(ordersCol(), orderBy("created_at", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
}

export async function getOrderById(id: string): Promise<Order | undefined> {
  const snap = await getDoc(doc(db, "orders", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } as Order : undefined;
}

export async function updateOrder(id: string, data: Partial<Omit<Order, 'id' | 'created_at' | 'is_synced'>>): Promise<void> {
  await updateDoc(doc(db, "orders", id), clean(data));
}

export async function updateOrderStatus(id: string, status: string): Promise<void> {
  await updateDoc(doc(db, "orders", id), { status });
}

export async function voidOrder(id: string): Promise<void> {
  await updateDoc(doc(db, "orders", id), { is_void: true });
}

export function onOrdersSnapshot(cb: (orders: Order[]) => void): Unsubscribe {
  return onSnapshot(query(ordersCol(), orderBy("created_at", "desc")), snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
  });
}

// ─── Order Items ─────────────────────────────────────────────────────────────

export async function saveOrderItems(items: Omit<OrderItem, 'id'>[]): Promise<void> {
  const batch = writeBatch(db);
  items.forEach(item => {
    batch.set(doc(orderItemsCol()), clean(item));
  });
  await batch.commit();
}

export async function getOrderItems(order_id: string): Promise<OrderItem[]> {
  const snap = await getDocs(query(orderItemsCol(), where("order_id", "==", order_id)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as OrderItem));
}

export async function replaceOrderItems(order_id: string, items: Omit<OrderItem, 'id'>[]): Promise<void> {
  const batch = writeBatch(db);
  // Delete old items
  const old = await getDocs(query(orderItemsCol(), where("order_id", "==", order_id)));
  old.docs.forEach(d => batch.delete(d.ref));
  // Add new items
  const total = items.reduce((s, i) => s + i.subtotal, 0);
  items.forEach(item => batch.set(doc(orderItemsCol()), clean(item)));
  batch.update(doc(db, "orders", order_id), { total, is_synced: false });
  await batch.commit();
}

export function onOrderItemsSnapshot(order_id: string, cb: (items: OrderItem[]) => void): Unsubscribe {
  return onSnapshot(query(orderItemsCol(), where("order_id", "==", order_id)), snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as OrderItem)));
  });
}

// ─── Sync Queue ───────────────────────────────────────────────────────────────

export async function addToSyncQueue(order_id: string): Promise<void> {
  const existing = await getDocs(query(syncQueueCol(), where("order_id", "==", order_id), where("status", "==", "pending")));
  if (existing.empty) {
    await addDoc(syncQueueCol(), clean({ order_id, created_at: new Date().toISOString(), status: "pending" }));
  }
}

export async function requeueOrderSync(order_id: string): Promise<void> {
  const batch = writeBatch(db);
  const existing = await getDocs(query(syncQueueCol(), where("order_id", "==", order_id)));
  if (!existing.empty) {
    existing.docs.forEach(d => batch.update(d.ref, { status: "pending", action: "update" }));
  } else {
    batch.set(doc(syncQueueCol()), clean({ order_id, created_at: new Date().toISOString(), status: "pending", action: "update" }));
  }
  batch.update(doc(db, "orders", order_id), { is_synced: false });
  await batch.commit();
}

export async function getPendingSyncItems(): Promise<SyncQueue[]> {
  const snap = await getDocs(query(syncQueueCol(), where("status", "==", "pending")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as SyncQueue));
}

export async function getFailedSyncItems(): Promise<SyncQueue[]> {
  const snap = await getDocs(query(syncQueueCol(), where("status", "in", ["pending", "failed"])));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as SyncQueue));
}

export async function markSyncDone(order_id: string): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, "orders", order_id), { is_synced: true });
  const snap = await getDocs(query(syncQueueCol(), where("order_id", "==", order_id)));
  snap.docs.forEach(d => batch.update(d.ref, { status: "done" }));
  await batch.commit();
}

export async function markSyncFailed(order_id: string): Promise<void> {
  const snap = await getDocs(query(syncQueueCol(), where("order_id", "==", order_id)));
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { status: "failed" }));
  await batch.commit();
}

export async function getPendingSyncCount(): Promise<number> {
  const snap = await getDocs(query(syncQueueCol(), where("status", "in", ["pending", "failed"])));
  return snap.size;
}

// ─── Store Settings ───────────────────────────────────────────────────────────

export async function getStoreSettings(): Promise<StoreSettings | undefined> {
  const snap = await getDocs(settingsCol());
  if (snap.empty) return undefined;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as StoreSettings;
}

export async function saveStoreSettings(data: Omit<StoreSettings, 'id'>): Promise<void> {
  const snap = await getDocs(settingsCol());
  const now = new Date().toISOString();
  if (!snap.empty) {
    await updateDoc(snap.docs[0].ref, clean({ ...data, updated_at: now }));
  } else {
    await addDoc(settingsCol(), clean({ ...data, created_at: now, updated_at: now }));
  }
}

export function onSettingsSnapshot(cb: (settings: StoreSettings | undefined) => void): Unsubscribe {
  return onSnapshot(settingsCol(), snap => {
    if (snap.empty) cb(undefined);
    else cb({ id: snap.docs[0].id, ...snap.docs[0].data() } as StoreSettings);
  });
}

// Re-export db for backwards compatibility
export { db } from "@/database/firebase";
