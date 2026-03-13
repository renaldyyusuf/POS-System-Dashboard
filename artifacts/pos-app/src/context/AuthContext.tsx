import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, type User,
} from "firebase/auth";
import { auth, db } from "@/database/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  storeName: string;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, storeName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [storeName, setStoreName] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, async u => {
      setUser(u);
      if (u) {
        // Load store name from Firestore
        const snap = await getDoc(doc(db, "stores", u.uid));
        if (snap.exists()) setStoreName(snap.data().store_name ?? "");
      } else {
        setStoreName("");
      }
      setLoading(false);
    });
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (email: string, password: string, storeName: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    // Save store metadata
    await setDoc(doc(db, "stores", cred.user.uid), {
      store_name: storeName,
      email,
      created_at: new Date().toISOString(),
    });
    setStoreName(storeName);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, storeName, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
