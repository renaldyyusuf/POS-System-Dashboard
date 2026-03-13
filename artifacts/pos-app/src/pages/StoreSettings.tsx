import { useEffect, useState } from "react";
import { db, type StoreSettings } from "@/database/db";
import {
  Save, Store, Phone, MapPin, Building2, CreditCard,
  User, FileText, CheckCircle2, Plus, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

// ── Bank account type ──────────────────────────────────────────────────────

export interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
}

function newAccount(): BankAccount {
  return { id: crypto.randomUUID(), bank_name: "", account_number: "", account_holder: "" };
}

function parseBankAccounts(raw: string | undefined): BankAccount[] {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ── Form type ──────────────────────────────────────────────────────────────

type FormData = Omit<StoreSettings, "id" | "created_at" | "updated_at">;

const defaultForm = (): FormData => ({
  store_name: "",
  phone_number: "",
  store_address: "",
  bank_name: "",
  bank_account_number: "",
  bank_account_holder: "",
  additional_notes: "",
  bank_accounts: "[]",
});

// ── DB helpers ─────────────────────────────────────────────────────────────

async function getStoreSettings(): Promise<StoreSettings | undefined> {
  return db.store_settings.toCollection().first();
}

async function saveStoreSettings(data: FormData): Promise<void> {
  const existing = await getStoreSettings();
  const now = new Date().toISOString();
  if (existing?.id) {
    await db.store_settings.update(existing.id, { ...data, updated_at: now });
  } else {
    await db.store_settings.add({ ...data, created_at: now, updated_at: now });
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────

function FieldRow({
  icon, label, children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm flex items-center gap-1.5 text-foreground font-medium">
        <span className="text-muted-foreground">{icon}</span>
        {label}
      </Label>
      {children}
    </div>
  );
}

function BankAccountCard({
  account,
  index,
  total,
  onChange,
  onRemove,
}: {
  account: BankAccount;
  index: number;
  total: number;
  onChange: (id: string, field: keyof BankAccount, value: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="relative rounded-xl border border-border bg-background/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Rekening {index + 1}
        </span>
        {total > 1 && (
          <button
            onClick={() => onRemove(account.id)}
            className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Hapus rekening"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Building2 size={11} /> Nama Bank
          </Label>
          <Input
            placeholder="BCA, Mandiri, BNI..."
            className="bg-background border-border h-9 text-sm"
            value={account.bank_name}
            onChange={e => onChange(account.id, "bank_name", e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CreditCard size={11} /> No. Rekening
          </Label>
          <Input
            placeholder="1234567890"
            className="bg-background border-border h-9 text-sm font-mono"
            value={account.account_number}
            onChange={e => onChange(account.id, "account_number", e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <User size={11} /> Atas Nama
          </Label>
          <Input
            placeholder="Nama pemilik rekening"
            className="bg-background border-border h-9 text-sm"
            value={account.account_holder}
            onChange={e => onChange(account.id, "account_holder", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function StoreSettings() {
  const [form, setForm]         = useState<FormData>(defaultForm());
  const [accounts, setAccounts] = useState<BankAccount[]>([newAccount()]);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved]       = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    getStoreSettings().then(settings => {
      if (!settings) return;
      setForm({
        store_name:           settings.store_name,
        phone_number:         settings.phone_number,
        store_address:        settings.store_address,
        bank_name:            settings.bank_name,
        bank_account_number:  settings.bank_account_number,
        bank_account_holder:  settings.bank_account_holder,
        additional_notes:     settings.additional_notes,
        bank_accounts:        settings.bank_accounts ?? "[]",
      });

      const parsed = parseBankAccounts(settings.bank_accounts);
      if (parsed.length > 0) {
        setAccounts(parsed);
      } else if (settings.bank_name || settings.bank_account_number) {
        // Migrate legacy single account
        setAccounts([{
          id: crypto.randomUUID(),
          bank_name:      settings.bank_name ?? "",
          account_number: settings.bank_account_number ?? "",
          account_holder: settings.bank_account_holder ?? "",
        }]);
      }
    });
  }, []);

  const setField = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleAccountChange = (id: string, field: keyof BankAccount, value: string) => {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const handleAddAccount = () => setAccounts(prev => [...prev, newAccount()]);

  const handleRemoveAccount = (id: string) => {
    setAccounts(prev => prev.filter(a => a.id !== id));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const first = accounts[0];
      const dataToSave: FormData = {
        ...form,
        bank_name:           first?.bank_name ?? "",
        bank_account_number: first?.account_number ?? "",
        bank_account_holder: first?.account_holder ?? "",
        bank_accounts:       JSON.stringify(accounts),
      };
      await saveStoreSettings(dataToSave);
      setSaved(true);
      toast({ title: "Pengaturan disimpan", description: "Informasi toko berhasil diperbarui." });
      setTimeout(() => setSaved(false), 3000);
    } catch {
      toast({ title: "Gagal menyimpan", description: "Terjadi kesalahan. Coba lagi.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500 pb-8">

      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Pengaturan Toko</h1>
        <p className="text-muted-foreground mt-1">Atur informasi toko dan detail pembayaran.</p>
      </div>

      {/* Store Info */}
      <Card className="bg-card border-border shadow-lg shadow-black/10">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Store size={16} className="text-primary" />
            Informasi Toko
          </CardTitle>
          <CardDescription>Detail dasar toko yang ditampilkan di struk.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FieldRow icon={<Store size={14} />} label="Nama Toko">
            <Input
              placeholder="cth. Lumina Café"
              className="bg-background border-border"
              value={form.store_name}
              onChange={e => setField("store_name", e.target.value)}
            />
          </FieldRow>
          <FieldRow icon={<Phone size={14} />} label="No. Telepon">
            <Input
              placeholder="cth. 08123456789"
              type="tel"
              className="bg-background border-border"
              value={form.phone_number}
              onChange={e => setField("phone_number", e.target.value)}
            />
          </FieldRow>
          <FieldRow icon={<MapPin size={14} />} label="Alamat Toko">
            <Textarea
              placeholder="Masukkan alamat lengkap toko..."
              className="bg-background border-border resize-none min-h-[80px]"
              value={form.store_address}
              onChange={e => setField("store_address", e.target.value)}
            />
          </FieldRow>
        </CardContent>
      </Card>

      {/* Payment Info — multi-account */}
      <Card className="bg-card border-border shadow-lg shadow-black/10">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard size={16} className="text-primary" />
                Detail Pembayaran
              </CardTitle>
              <CardDescription className="mt-1">
                Rekening bank untuk pembayaran Transfer. Tambahkan lebih dari satu jika perlu.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary font-semibold"
              onClick={handleAddAccount}
            >
              <Plus size={13} className="mr-1.5" /> Tambah Rekening
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {accounts.map((account, index) => (
            <BankAccountCard
              key={account.id}
              account={account}
              index={index}
              total={accounts.length}
              onChange={handleAccountChange}
              onRemove={handleRemoveAccount}
            />
          ))}
        </CardContent>
      </Card>

      {/* Additional Notes */}
      <Card className="bg-card border-border shadow-lg shadow-black/10">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText size={16} className="text-primary" />
            Catatan Tambahan
          </CardTitle>
          <CardDescription>Teks footer di struk (cth. "Terima kasih sudah memesan!").</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="cth. Terima kasih sudah memesan! Follow us @luminacafe"
            className="bg-background border-border resize-none min-h-[90px]"
            value={form.additional_notes}
            onChange={e => setField("additional_notes", e.target.value)}
          />
        </CardContent>
      </Card>

      <Separator />

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className={`min-w-[140px] font-bold shadow-md transition-all duration-300 ${
            saved
              ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/30"
              : "shadow-primary/20"
          }`}
        >
          {saved ? (
            <><CheckCircle2 size={15} className="mr-2" /> Tersimpan!</>
          ) : isSaving ? (
            "Menyimpan..."
          ) : (
            <><Save size={15} className="mr-2" /> Simpan Pengaturan</>
          )}
        </Button>
      </div>
    </div>
  );
}
