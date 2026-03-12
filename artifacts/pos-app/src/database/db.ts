import Dexie, { type Table } from 'dexie';

export interface Product {
  id?: number;
  name: string;
  category: string;
  price: number;
  stock: number;
  emoji: string;
}

export interface OrderItem {
  productId: number;
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id?: number;
  orderNumber: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: 'cash' | 'card';
  status: 'pending' | 'in-progress' | 'ready' | 'delivered';
  createdAt: string;
}

export class POSDatabase extends Dexie {
  products!: Table<Product, number>;
  orders!: Table<Order, number>;

  constructor() {
    super('POSDatabase');
    this.version(1).stores({
      products: '++id, name, category, price, stock',
      orders: '++id, orderNumber, status, createdAt',
    });
  }
}

export const db = new POSDatabase();

// Seed initial data
db.on('populate', async () => {
  await db.products.bulkAdd([
    { name: 'Espresso', category: 'Coffee', price: 3.50, stock: 100, emoji: '☕' },
    { name: 'Latte', category: 'Coffee', price: 4.50, stock: 100, emoji: '🥛' },
    { name: 'Cappuccino', category: 'Coffee', price: 4.50, stock: 100, emoji: '☕' },
    { name: 'Mocha', category: 'Coffee', price: 4.75, stock: 100, emoji: '🍫' },
    { name: 'Iced Coffee', category: 'Cold Drinks', price: 4.00, stock: 100, emoji: '🧊' },
    { name: 'Cold Brew', category: 'Cold Drinks', price: 4.50, stock: 100, emoji: '🥤' },
    { name: 'Green Tea', category: 'Tea', price: 3.00, stock: 50, emoji: '🍵' },
    { name: 'Matcha Latte', category: 'Tea', price: 5.00, stock: 50, emoji: '🌿' },
    { name: 'Croissant', category: 'Pastries', price: 3.50, stock: 20, emoji: '🥐' },
    { name: 'Chocolate Croissant', category: 'Pastries', price: 4.00, stock: 15, emoji: '🥐' },
    { name: 'Blueberry Muffin', category: 'Pastries', price: 3.75, stock: 15, emoji: '🧁' },
    { name: 'Avocado Toast', category: 'Food', price: 8.50, stock: 10, emoji: '🥑' },
    { name: 'Breakfast Sandwich', category: 'Food', price: 9.00, stock: 15, emoji: '🥪' },
    { name: 'Acai Bowl', category: 'Food', price: 9.50, stock: 10, emoji: '🫐' },
  ]);
});
