import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Product } from "@/database/db";
import { formatCurrency } from "@/utils/format";
import { Plus, Pencil, Trash2, Search, PackageOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  Body,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableBody
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function Products() {
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState<Omit<Product, 'id'>>({
    name: "",
    category: "",
    price: 0,
    stock: 0,
    emoji: "📦"
  });

  const products = useLiveQuery(() => db.products.toArray()) || [];

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData({ name: "", category: "", price: 0, stock: 0, emoji: "📦" });
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      price: product.price,
      stock: product.stock,
      emoji: product.emoji
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this product?")) {
      await db.products.delete(id);
      toast({ title: "Product deleted" });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct?.id) {
        await db.products.update(editingProduct.id, formData);
        toast({ title: "Product updated successfully" });
      } else {
        await db.products.add(formData);
        toast({ title: "Product created successfully" });
      }
      setIsModalOpen(false);
    } catch (error) {
      toast({ title: "Error saving product", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Products</h1>
          <p className="text-muted-foreground mt-1">Manage your inventory and pricing.</p>
        </div>
        <Button onClick={openAddModal} className="font-semibold shadow-lg shadow-primary/20">
          <Plus className="mr-2 h-4 w-4" /> Add Product
        </Button>
      </div>

      <Card className="bg-card border-border shadow-xl shadow-black/10 overflow-hidden">
        <div className="p-4 border-b border-border/50 bg-card/50">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name or category..." 
              className="pl-9 bg-background border-border"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        <Table>
          <TableHeader className="bg-secondary/50">
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="w-16 text-center">Icon</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center">
                    <PackageOpen className="h-10 w-10 mb-3 opacity-20" />
                    No products found.
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => (
                <TableRow key={product.id} className="border-border/50 hover:bg-secondary/30 transition-colors">
                  <TableCell className="text-center text-2xl">{product.emoji}</TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>
                    <span className="px-2.5 py-1 rounded-full bg-secondary text-xs font-medium text-muted-foreground border border-border">
                      {product.category}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium text-primary">
                    {formatCurrency(product.price)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={product.stock < 10 ? "text-destructive font-bold" : "text-muted-foreground"}>
                      {product.stock}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditModal(product)} className="h-8 w-8 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => product.id && handleDelete(product.id)} className="h-8 w-8 text-destructive hover:text-red-400 hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {editingProduct ? "Edit Product" : "Add New Product"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Product Name</Label>
              <Input 
                id="name" 
                required 
                className="bg-background border-border"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input 
                  id="category" 
                  required 
                  className="bg-background border-border"
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emoji">Emoji Icon</Label>
                <Input 
                  id="emoji" 
                  required 
                  maxLength={2}
                  className="bg-background border-border text-center text-xl"
                  value={formData.emoji}
                  onChange={e => setFormData({...formData, emoji: e.target.value})}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price ($)</Label>
                <Input 
                  id="price" 
                  type="number" 
                  step="0.01" 
                  min="0" 
                  required 
                  className="bg-background border-border"
                  value={formData.price}
                  onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock">Stock Level</Label>
                <Input 
                  id="stock" 
                  type="number" 
                  min="0" 
                  required 
                  className="bg-background border-border"
                  value={formData.stock}
                  onChange={e => setFormData({...formData, stock: parseInt(e.target.value)})}
                />
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" className="font-bold">Save Product</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
