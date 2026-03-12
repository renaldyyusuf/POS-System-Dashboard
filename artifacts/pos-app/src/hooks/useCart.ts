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
  addItem: (product: { id: number; name: string; price: number; portion_size: string }) => void;
  removeItem: (product_id: number) => void;
  updateQty: (product_id: number, qty: number) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getTotal: () => number;
}

export const useCart = create<CartState>((set, get) => ({
  items: [],

  addItem: (product) => {
    if (!product.id) return;
    set((state) => {
      const existing = state.items.find(item => item.product_id === product.id);
      if (existing) {
        return {
          items: state.items.map(item =>
            item.product_id === product.id
              ? { ...item, qty: item.qty + 1 }
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
            qty: 1,
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

  getSubtotal: () =>
    get().items.reduce((sum, item) => sum + item.price * item.qty, 0),

  getTotal: () => get().getSubtotal(),
}));
