import { useEffect, useState } from "react";
import { db, type StoreSettings } from "@/database/db";
import { Save, Store, Phone, MapPin, Building2, CreditCard, User, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

type FormData = Omit<StoreSettings, "id" | "created_at" | "updated_at">;

const defaultForm = (): FormData => ({
  store_name: "",
  phone_number: "",
  store_address: "",
  bank_name: "",
  bank_account_number: "",
  bank_account_holder: "",
  additional_notes: "",
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

// ── Component ──────────────────────────────────────────────────────────────

function FieldRow({
  icon,
  label,
  children,
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

export default function StoreSettings() {
  const [form, setForm] = useState<FormData>(defaultForm());
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { toast } = useToast();

  // Load existing settings on mount
  useEffect(() => {
    getStoreSettings().then(settings => {
      if (settings) {
        setForm({
          store_name: settings.store_name,
          phone_number: settings.phone_number,
          store_address: settings.store_address,
          bank_name: settings.bank_name,
          bank_account_number: settings.bank_account_number,
          bank_account_holder: settings.bank_account_holder,
          additional_notes: settings.additional_notes,
        });
      }
    });
  }, []);

  const setField = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveStoreSettings(form);
      setSaved(true);
      toast({ title: "Settings saved", description: "Store settings have been updated successfully." });
      setTimeout(() => setSaved(false), 3000);
    } catch {
      toast({ title: "Failed to save", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500 pb-8">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Store Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your store's information and payment details.</p>
      </div>

      {/* Store Info */}
      <Card className="bg-card border-border shadow-lg shadow-black/10">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Store size={16} className="text-primary" />
            Store Information
          </CardTitle>
          <CardDescription>Basic details about your store shown on receipts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FieldRow icon={<Store size={14} />} label="Store Name">
            <Input
              placeholder="e.g. Lumina Café"
              className="bg-background border-border"
              value={form.store_name}
              onChange={e => setField("store_name", e.target.value)}
            />
          </FieldRow>

          <FieldRow icon={<Phone size={14} />} label="Phone Number">
            <Input
              placeholder="e.g. 08123456789"
              type="tel"
              className="bg-background border-border"
              value={form.phone_number}
              onChange={e => setField("phone_number", e.target.value)}
            />
          </FieldRow>

          <FieldRow icon={<MapPin size={14} />} label="Store Address">
            <Textarea
              placeholder="Enter your full store address..."
              className="bg-background border-border resize-none min-h-[80px]"
              value={form.store_address}
              onChange={e => setField("store_address", e.target.value)}
            />
          </FieldRow>
        </CardContent>
      </Card>

      {/* Payment Info */}
      <Card className="bg-card border-border shadow-lg shadow-black/10">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard size={16} className="text-primary" />
            Payment Details
          </CardTitle>
          <CardDescription>Bank account details for Transfer payments.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FieldRow icon={<Building2 size={14} />} label="Bank Name">
            <Input
              placeholder="e.g. BCA, Mandiri, BNI"
              className="bg-background border-border"
              value={form.bank_name}
              onChange={e => setField("bank_name", e.target.value)}
            />
          </FieldRow>

          <FieldRow icon={<CreditCard size={14} />} label="Account Number">
            <Input
              placeholder="e.g. 1234567890"
              className="bg-background border-border font-mono"
              value={form.bank_account_number}
              onChange={e => setField("bank_account_number", e.target.value)}
            />
          </FieldRow>

          <FieldRow icon={<User size={14} />} label="Account Holder Name">
            <Input
              placeholder="e.g. John Doe"
              className="bg-background border-border"
              value={form.bank_account_holder}
              onChange={e => setField("bank_account_holder", e.target.value)}
            />
          </FieldRow>
        </CardContent>
      </Card>

      {/* Additional Notes */}
      <Card className="bg-card border-border shadow-lg shadow-black/10">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText size={16} className="text-primary" />
            Additional Notes
          </CardTitle>
          <CardDescription>Custom footer text shown on receipts (e.g. "Thank you for your order!").</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="e.g. Terima kasih sudah memesan! Follow us @luminacafe"
            className="bg-background border-border resize-none min-h-[90px]"
            value={form.additional_notes}
            onChange={e => setField("additional_notes", e.target.value)}
          />
        </CardContent>
      </Card>

      <Separator />

      {/* Save button */}
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
            <>
              <CheckCircle2 size={15} className="mr-2" /> Saved!
            </>
          ) : isSaving ? (
            "Saving..."
          ) : (
            <>
              <Save size={15} className="mr-2" /> Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
