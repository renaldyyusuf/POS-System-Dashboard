import { create } from 'zustand';
import type { Product, OrderItem } from '@/database/db';

interface CartState {
  items: OrderItem[];
  addItem: (product: Product) => void;
  removeItem: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getTax: () => number;
  getTotal: () => number;
}

const TAX_RATE = 0.08; // 8% tax

export const useCart = create<CartState>((set, get) => ({
  items: [],
  
  addItem: (product) => {
    if (!product.id) return;
    
    set((state) => {
      const existingItem = state.items.find(item => item.productId === product.id);
      if (existingItem) {
        return {
          items: state.items.map(item => 
            item.productId === product.id 
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        };
      }
      return {
        items: [...state.items, {
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: 1
        }]
      };
    });
  },

  removeItem: (productId) => {
    set((state) => ({
      items: state.items.filter(item => item.productId !== productId)
    }));
  },

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }
    
    set((state) => ({
      items: state.items.map(item => 
        item.productId === productId 
          ? { ...item, quantity }
          : item
      )
    }));
  },

  clearCart: () => {
    set({ items: [] });
  },

  getSubtotal: () => {
    return get().items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  },

  getTax: () => {
    return get().getSubtotal() * TAX_RATE;
  },

  getTotal: () => {
    return get().getSubtotal() + get().getTax();
  }
}));
