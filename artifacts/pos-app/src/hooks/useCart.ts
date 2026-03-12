import { create } from 'zustand';

export interface CartItem {
  product_id: number;
  product_name: string;
  price: number;
  portion_size: string;
  qty: number;
}

interface CartState {
  items: CartItem[];
  addItem: (product: { id: number; name: string; price: number; portion_size: string }, qty?: number) => void;
  removeItem: (product_id: number) => void;
  updateQty: (product_id: number, qty: number) => void;
  clearCart: () => void;
  getTotal: () => number;
}

export const useCart = create<CartState>((set, get) => ({
  items: [],

  addItem: (product, qty = 1) => {
    if (!product.id || qty <= 0) return;
    set((state) => {
      const existing = state.items.find(item => item.product_id === product.id);
      if (existing) {
        return {
          items: state.items.map(item =>
            item.product_id === product.id
              ? { ...item, qty: item.qty + qty }
              : item
          ),
        };
      }
      return {
        items: [
          ...state.items,
          {
            product_id: product.id,
            product_name: product.name,
            price: product.price,
            portion_size: product.portion_size,
            qty,
          },
        ],
      };
    });
  },

  removeItem: (product_id) => {
    set((state) => ({
      items: state.items.filter(item => item.product_id !== product_id),
    }));
  },

  updateQty: (product_id, qty) => {
    if (qty <= 0) {
      get().removeItem(product_id);
      return;
    }
    set((state) => ({
      items: state.items.map(item =>
        item.product_id === product_id ? { ...item, qty } : item
      ),
    }));
  },

  clearCart: () => set({ items: [] }),

  getTotal: () =>
    get().items.reduce((sum, item) => sum + item.price * item.qty, 0),
}));
