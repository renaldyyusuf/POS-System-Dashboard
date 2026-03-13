// ─── Firestore Database Layer (multi-store, per-user data isolation) ──────────
// Each user's data lives under stores/{uid}/... so stores never see each other's data.

import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, getDoc, query, orderBy, where,
  onSnapshot, writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/database/firebase";
import { auth } from "@/database/firebase";

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid(): string {
  const u = auth.currentUser;
  if (!u) throw new Error("Not authenticated");
  return u.uid;
}

function storeCol(col: string) {
  return collection(db, "stores", uid(), col);
}

function storeDoc(col: string, id: string) {
  return doc(db, "stores", uid(), col, id);
}

function clean<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T;
}

// Re-export db for any file that still imports it directly
export { db } from "@/database/firebase";

// ─── Products ────────────────────────────────────────────────────────────────

export async function addProduct(data: Omit<Product, 'id' | 'created_at'>): Promise<string> {
  const ref = await addDoc(storeCol("products"), clean({ ...data, created_at: new Date().toISOString() }));
  return ref.id;
}

export async function updateProduct(id: string, data: Partial<Omit<Product, 'id' | 'created_at'>>): Promise<void> {
  await updateDoc(storeDoc("products", id), clean(data));
}

export async function deleteProduct(id: string): Promise<void> {
  await deleteDoc(storeDoc("products", id));
}

export async function getProducts(): Promise<Product[]> {
  const snap = await getDocs(query(storeCol("products"), orderBy("created_at", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
}

export function onProductsSnapshot(cb: (products: Product[]) => void): Unsubscribe {
  return onSnapshot(query(storeCol("products"), orderBy("created_at", "desc")), snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
  });
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export async function createOrder(data: Omit<Order, 'id' | 'created_at' | 'is_void' | 'is_synced'>): Promise<string> {
  const ref = await addDoc(storeCol("orders"), clean({
    ...data,
    created_at: new Date().toISOString(),
    is_void: false,
    is_synced: false,
  }));
  return ref.id;
}

export async function getOrders(): Promise<Order[]> {
  const snap = await getDocs(query(storeCol("orders"), orderBy("created_at", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
}

export async function getOrderById(id: string): Promise<Order | undefined> {
  const snap = await getDoc(storeDoc("orders", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } as Order : undefined;
}

export async function updateOrder(id: string, data: Partial<Omit<Order, 'id' | 'created_at' | 'is_synced'>>): Promise<void> {
  await updateDoc(storeDoc("orders", id), clean(data));
}

export async function updateOrderStatus(id: string, status: string): Promise<void> {
  await updateDoc(storeDoc("orders", id), { status });
}

export async function voidOrder(id: string): Promise<void> {
  await updateDoc(storeDoc("orders", id), { is_void: true });
}

export function onOrdersSnapshot(cb: (orders: Order[]) => void): Unsubscribe {
  return onSnapshot(query(storeCol("orders"), orderBy("created_at", "desc")), snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
  });
}

// ─── Order Items ─────────────────────────────────────────────────────────────

export async function saveOrderItems(items: Omit<OrderItem, 'id'>[]): Promise<void> {
  const batch = writeBatch(db);
  items.forEach(item => batch.set(doc(storeCol("order_items")), clean(item)));
  await batch.commit();
}

export async function getOrderItems(order_id: string): Promise<OrderItem[]> {
  const snap = await getDocs(query(storeCol("order_items"), where("order_id", "==", order_id)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as OrderItem));
}

export async function replaceOrderItems(order_id: string, items: Omit<OrderItem, 'id'>[]): Promise<void> {
  const batch = writeBatch(db);
  const old = await getDocs(query(storeCol("order_items"), where("order_id", "==", order_id)));
  old.docs.forEach(d => batch.delete(d.ref));
  const total = items.reduce((s, i) => s + i.subtotal, 0);
  items.forEach(item => batch.set(doc(storeCol("order_items")), clean(item)));
  batch.update(storeDoc("orders", order_id), { total, is_synced: false });
  await batch.commit();
}

export function onOrderItemsSnapshot(order_id: string, cb: (items: OrderItem[]) => void): Unsubscribe {
  return onSnapshot(query(storeCol("order_items"), where("order_id", "==", order_id)), snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as OrderItem)));
  });
}

// ─── Sync Queue ───────────────────────────────────────────────────────────────

export async function addToSyncQueue(order_id: string): Promise<void> {
  const existing = await getDocs(query(storeCol("sync_queue"), where("order_id", "==", order_id), where("status", "==", "pending")));
  if (existing.empty) {
    await addDoc(storeCol("sync_queue"), clean({ order_id, created_at: new Date().toISOString(), status: "pending" }));
  }
}

export async function requeueOrderSync(order_id: string): Promise<void> {
  const batch = writeBatch(db);
  const existing = await getDocs(query(storeCol("sync_queue"), where("order_id", "==", order_id)));
  if (!existing.empty) {
    existing.docs.forEach(d => batch.update(d.ref, { status: "pending", action: "update" }));
  } else {
    batch.set(doc(storeCol("sync_queue")), clean({ order_id, created_at: new Date().toISOString(), status: "pending", action: "update" }));
  }
  batch.update(storeDoc("orders", order_id), { is_synced: false });
  await batch.commit();
}

export async function getFailedSyncItems(): Promise<SyncQueue[]> {
  const snap = await getDocs(query(storeCol("sync_queue"), where("status", "in", ["pending", "failed"])));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as SyncQueue));
}

export async function getPendingSyncItems(): Promise<SyncQueue[]> {
  return getFailedSyncItems();
}

export async function markSyncDone(order_id: string): Promise<void> {
  const batch = writeBatch(db);
  batch.update(storeDoc("orders", order_id), { is_synced: true });
  const snap = await getDocs(query(storeCol("sync_queue"), where("order_id", "==", order_id)));
  snap.docs.forEach(d => batch.update(d.ref, { status: "done" }));
  await batch.commit();
}

export async function markSyncFailed(order_id: string): Promise<void> {
  const snap = await getDocs(query(storeCol("sync_queue"), where("order_id", "==", order_id)));
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { status: "failed" }));
  await batch.commit();
}

export async function getPendingSyncCount(): Promise<number> {
  const snap = await getDocs(query(storeCol("sync_queue"), where("status", "in", ["pending", "failed"])));
  return snap.size;
}

// ─── Store Settings ───────────────────────────────────────────────────────────

export async function getStoreSettings(): Promise<StoreSettings | undefined> {
  const snap = await getDocs(storeCol("store_settings"));
  if (snap.empty) return undefined;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as StoreSettings;
}

export async function saveStoreSettings(data: Omit<StoreSettings, 'id'>): Promise<void> {
  const snap = await getDocs(storeCol("store_settings"));
  const now = new Date().toISOString();
  if (!snap.empty) {
    await updateDoc(snap.docs[0].ref, clean({ ...data, updated_at: now }));
  } else {
    await addDoc(storeCol("store_settings"), clean({ ...data, created_at: now, updated_at: now }));
  }
}

export function onSettingsSnapshot(cb: (settings: StoreSettings | undefined) => void): Unsubscribe {
  return onSnapshot(storeCol("store_settings"), snap => {
    if (snap.empty) cb(undefined);
    else cb({ id: snap.docs[0].id, ...snap.docs[0].data() } as StoreSettings);
  });
}
