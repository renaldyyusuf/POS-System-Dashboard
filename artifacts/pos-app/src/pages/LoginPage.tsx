import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Coffee, Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";

type Mode = "login" | "register";

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [storeName, setStoreName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (!email || !password) { setError("Email dan password wajib diisi."); return; }
    if (mode === "register" && !storeName) { setError("Nama toko wajib diisi."); return; }
    if (password.length < 6) { setError("Password minimal 6 karakter."); return; }

    setLoading(true);
    try {
      if (mode === "register") {
        await register(email, password, storeName);
      } else {
        await login(email, password);
      }
    } catch (e: any) {
      const msg: Record<string, string> = {
        "auth/invalid-credential":    "Email atau password salah.",
        "auth/email-already-in-use":  "Email sudah terdaftar.",
        "auth/invalid-email":         "Format email tidak valid.",
        "auth/weak-password":         "Password terlalu lemah.",
        "auth/user-not-found":        "Akun tidak ditemukan.",
        "auth/wrong-password":        "Password salah.",
        "auth/too-many-requests":     "Terlalu banyak percobaan. Coba lagi nanti.",
      };
      setError(msg[e.code] ?? "Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
            <Coffee size={28} className="text-primary" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">Lumina POS</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "login" ? "Masuk ke akun toko Anda" : "Daftarkan toko baru"}
          </p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          {mode === "register" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Nama Toko</label>
              <input
                type="text"
                value={storeName}
                onChange={e => setStoreName(e.target.value)}
                placeholder="Contoh: Warung Opor Bu Ani"
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                placeholder="email@toko.com"
                className="w-full bg-background border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                placeholder="Minimal 6 karakter"
                className="w-full bg-background border border-border rounded-xl pl-9 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground font-semibold rounded-xl py-2.5 text-sm flex items-center justify-center gap-2 transition-colors"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {mode === "login" ? "Masuk" : "Daftar Toko"}
          </button>
        </div>

        {/* Toggle mode */}
        <p className="text-center text-sm text-muted-foreground mt-4">
          {mode === "login" ? (
            <>Belum punya akun?{" "}
              <button onClick={() => { setMode("register"); setError(""); }} className="text-primary font-medium hover:underline">
                Daftar toko baru
              </button>
            </>
          ) : (
            <>Sudah punya akun?{" "}
              <button onClick={() => { setMode("login"); setError(""); }} className="text-primary font-medium hover:underline">
                Masuk
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
