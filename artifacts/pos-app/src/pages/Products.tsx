import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, addProduct, updateProduct, deleteProduct, type Product } from "@/database/db";
import { formatCurrency, formatDate } from "@/utils/format";
import { Plus, Pencil, Trash2, Search, PackageOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type ProductForm = { name: string; price: number; portion_size: string };
const emptyForm: ProductForm = { name: "", price: 0, portion_size: "" };

export default function Products() {
  const [search, setSearch]               = useState("");
  const [isModalOpen, setIsModalOpen]     = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData]           = useState<ProductForm>(emptyForm);
  const [deleteTarget, setDeleteTarget]   = useState<Product | null>(null);
  const { toast } = useToast();

  const products = useLiveQuery(() => db.products.orderBy("created_at").reverse().toArray()) || [];

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.portion_size.toLowerCase().includes(search.toLowerCase())
  );

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData(emptyForm);
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({ name: product.name, price: product.price, portion_size: product.portion_size });
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    await deleteProduct(deleteTarget.id);
    toast({ title: "Produk dihapus", description: `"${deleteTarget.name}" telah dihapus.` });
    setDeleteTarget(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct?.id) {
        await updateProduct(editingProduct.id, formData);
        toast({ title: "Produk diperbarui", description: `"${formData.name}" telah disimpan.` });
      } else {
        await addProduct(formData);
        toast({ title: "Produk ditambahkan", description: `"${formData.name}" telah ditambahkan.` });
      }
      setIsModalOpen(false);
    } catch {
      toast({ title: "Gagal menyimpan produk", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Produk</h1>
          <p className="text-muted-foreground mt-1">Kelola katalog produk dan harga.</p>
        </div>
        <Button onClick={openAddModal} className="font-semibold shadow-lg shadow-primary/20">
          <Plus className="mr-2 h-4 w-4" /> Tambah Produk
        </Button>
      </div>

      {/* Table */}
      <Card className="bg-card border-border shadow-xl shadow-black/10 overflow-hidden">
        <div className="p-4 border-b border-border/50 bg-card/50 flex items-center justify-between gap-4">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari berdasarkan nama atau ukuran..."
              className="pl-9 bg-background border-border"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <span className="text-sm text-muted-foreground whitespace-nowrap shrink-0">
            {filteredProducts.length} produk
          </span>
        </div>

        <Table>
          <TableHeader className="bg-secondary/50">
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="pl-6">#</TableHead>
              <TableHead>Nama Produk</TableHead>
              <TableHead>Porsi / Ukuran</TableHead>
              <TableHead className="text-right">Harga</TableHead>
              <TableHead>Tanggal Ditambahkan</TableHead>
              <TableHead className="text-right pr-6">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-52 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <PackageOpen className="h-12 w-12 opacity-15" />
                    <div>
                      <p className="font-medium">Produk tidak ditemukan</p>
                      <p className="text-sm mt-1">
                        {search
                          ? "Coba kata kunci lain."
                          : 'Klik "Tambah Produk" untuk memulai.'}
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product, index) => (
                <TableRow key={product.id} className="border-border/50 hover:bg-secondary/20 transition-colors">
                  <TableCell className="pl-6 text-muted-foreground text-sm font-mono">{index + 1}</TableCell>
                  <TableCell className="font-semibold text-foreground">{product.name}</TableCell>
                  <TableCell>
                    <span className="px-2.5 py-1 rounded-full bg-secondary text-xs font-medium text-muted-foreground border border-border">
                      {product.portion_size}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-bold text-primary tabular-nums">
                    {formatCurrency(product.price)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(product.created_at)}
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-blue-400 hover:bg-blue-400/10"
                        onClick={() => openEditModal(product)}
                        title="Edit produk"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteTarget(product)}
                        title="Hapus produk"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Add / Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[440px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {editingProduct ? "Edit Produk" : "Tambah Produk Baru"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Produk <span className="text-destructive">*</span></Label>
              <Input
                id="name" required
                placeholder="cth. Ayam Bakar"
                className="bg-background border-border"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="portion_size">Porsi / Ukuran <span className="text-destructive">*</span></Label>
              <Input
                id="portion_size" required
                placeholder="cth. Regular, Large, 250ml, 1 pcs"
                className="bg-background border-border"
                value={formData.portion_size}
                onChange={e => setFormData({ ...formData, portion_size: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Harga <span className="text-destructive">*</span></Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">Rp</span>
                <Input
                  id="price" type="number" step="1" min="0" required
                  placeholder="0"
                  className="bg-background border-border pl-9"
                  value={formData.price || ""}
                  onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" className="font-bold min-w-[100px]">
                {editingProduct ? "Simpan" : "Tambah Produk"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Produk</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus{" "}
              <span className="font-semibold text-foreground">"{deleteTarget?.name}"</span>?
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-background border-border hover:bg-secondary">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold"
              onClick={handleDelete}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
