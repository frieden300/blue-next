"use client";

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useCallback,
  type ReactNode,
} from "react";

/* ── Types ────────────────────────────────────────────────────── */
export interface CartItem {
  listingId: string;
  title: string;
  unitPrice: number;
  quantity: number;
  imageUrl?: string;
}

interface CartState {
  items: CartItem[];
}

type CartAction =
  | { type: "ADD"; item: Omit<CartItem, "quantity"> & { quantity?: number } }
  | { type: "REMOVE"; listingId: string }
  | { type: "SET_QTY"; listingId: string; quantity: number }
  | { type: "CLEAR" }
  | { type: "HYDRATE"; items: CartItem[] };

interface CartContextValue {
  items: CartItem[];
  count: number;
  total: number;
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  removeItem: (listingId: string) => void;
  setQty: (listingId: string, quantity: number) => void;
  clear: () => void;
}

/* ── Reducer ──────────────────────────────────────────────────── */
function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "HYDRATE":
      return { items: action.items };

    case "ADD": {
      const qty = action.item.quantity ?? 1;
      const existing = state.items.find((i) => i.listingId === action.item.listingId);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.listingId === action.item.listingId
              ? { ...i, quantity: Math.min(50, i.quantity + qty) }
              : i
          ),
        };
      }
      return {
        items: [
          ...state.items,
          { ...action.item, quantity: Math.min(50, qty) },
        ],
      };
    }

    case "REMOVE":
      return { items: state.items.filter((i) => i.listingId !== action.listingId) };

    case "SET_QTY":
      if (action.quantity <= 0) {
        return { items: state.items.filter((i) => i.listingId !== action.listingId) };
      }
      return {
        items: state.items.map((i) =>
          i.listingId === action.listingId
            ? { ...i, quantity: Math.min(50, action.quantity) }
            : i
        ),
      };

    case "CLEAR":
      return { items: [] };

    default:
      return state;
  }
}

/* ── Context ──────────────────────────────────────────────────── */
const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "blue_cart_v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [] });

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[];
        if (Array.isArray(parsed)) {
          dispatch({ type: "HYDRATE", items: parsed });
        }
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  // Persist to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    } catch {
      // ignore storage errors (private browsing, quota)
    }
  }, [state.items]);

  const addItem = useCallback(
    (item: Omit<CartItem, "quantity"> & { quantity?: number }) => {
      dispatch({ type: "ADD", item });
    },
    []
  );
  const removeItem = useCallback((listingId: string) => {
    dispatch({ type: "REMOVE", listingId });
  }, []);
  const setQty = useCallback((listingId: string, quantity: number) => {
    dispatch({ type: "SET_QTY", listingId, quantity });
  }, []);
  const clear = useCallback(() => {
    dispatch({ type: "CLEAR" });
  }, []);

  const count = state.items.reduce((s, i) => s + i.quantity, 0);
  const total = state.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items: state.items, count, total, addItem, removeItem, setQty, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
