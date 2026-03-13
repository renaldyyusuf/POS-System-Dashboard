import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, updateOrderStatus, type Order, type OrderItem } from "@/database/db";
import { Clock, MapPin, ShoppingBag } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";

// ── Column definitions ─────────────────────────────────────────────────────

interface Column {
  id: string;
  title: string;
  dot: string;
  topBorder: string;
  headerBg: string;
  dropActiveBg: string;
  emptyText: string;
}

const COLUMNS: Column[] = [
  {
    id: "pending",
    title: "Menunggu",
    dot: "bg-amber-400",
    topBorder: "border-t-amber-400",
    headerBg: "bg-amber-500/10",
    dropActiveBg: "bg-amber-500/8 border-amber-400/50",
    emptyText: "Tidak ada pesanan menunggu",
  },
  {
    id: "in-progress",
    title: "Diproses",
    dot: "bg-blue-400",
    topBorder: "border-t-blue-400",
    headerBg: "bg-blue-500/10",
    dropActiveBg: "bg-blue-500/8 border-blue-400/50",
    emptyText: "Tidak ada pesanan diproses",
  },
  {
    id: "ready",
    title: "Siap",
    dot: "bg-emerald-400",
    topBorder: "border-t-emerald-400",
    headerBg: "bg-emerald-500/10",
    dropActiveBg: "bg-emerald-500/8 border-emerald-400/50",
    emptyText: "Tidak ada pesanan siap",
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function formatReadyTime(iso: string) {
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

// ── Order Card ─────────────────────────────────────────────────────────────

function OrderCard({
  order,
  items,
  isDragging,
  onDragStart,
}: {
  order: Order;
  items: OrderItem[];
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, orderId: number) => void;
}) {
  const isOjol = order.fulfillment_method === "ojol";

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, order.id!)}
      className={`
        bg-card border border-border rounded-xl p-3.5 space-y-2.5
        cursor-grab active:cursor-grabbing select-none
        transition-all duration-150
        ${isDragging
          ? "opacity-30 scale-[0.97]"
          : "hover:shadow-md hover:border-border/70 shadow-sm"
        }
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-primary font-bold text-sm font-mono">#{order.id}</span>
          <p className="font-semibold text-foreground text-sm leading-snug mt-0.5">
            {order.customer_name}
          </p>
        </div>
        <span
          title={isOjol ? "Diantar (Ojol)" : "Ambil Sendiri"}
          className="text-xl leading-none mt-0.5 shrink-0"
        >
          {isOjol ? "🛵" : "🏪"}
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock size={11} />
        <span>
          Siap pukul {formatReadyTime(order.ready_date || order.created_at)}
          {" · "}
          <span className="opacity-70">
            {formatDistanceToNow(new Date(order.ready_date || order.created_at), { addSuffix: true, locale: idLocale })}
          </span>
        </span>
      </div>

      {items.length > 0 && (
        <div className="space-y-0.5 border-t border-border/40 pt-2">
          {items.slice(0, 3).map((item, i) => (
            <div key={i} className="flex gap-2 text-xs text-muted-foreground">
              <span className="font-bold text-foreground/60 w-4 shrink-0 tabular-nums text-right">
                {item.qty}×
              </span>
              <span className="truncate">{item.product_name}</span>
            </div>
          ))}
          {items.length > 3 && (
            <p className="text-xs text-muted-foreground/50 pl-6">
              +{items.length - 3} item lagi
            </p>
          )}
        </div>
      )}

      {isOjol && order.delivery_address && (
        <div className="flex gap-1.5 items-start bg-orange-500/8 border border-orange-500/20 rounded-lg px-2.5 py-1.5">
          <MapPin size={11} className="text-orange-400 mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {order.delivery_address}
          </p>
        </div>
      )}

      <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border ${
        isOjol
          ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
          : "bg-blue-500/10 text-blue-400 border-blue-500/20"
      }`}>
        {isOjol ? "🛵" : <ShoppingBag size={10} />}
        {isOjol ? "Diantar (Ojol)" : "Ambil Sendiri"}
      </span>
    </div>
  );
}

// ── Droppable Column ───────────────────────────────────────────────────────

function KanbanColumn({
  col, orders, allItems, draggingId, onDragStart, onDrop,
}: {
  col: Column;
  orders: Order[];
  allItems: OrderItem[];
  draggingId: number | null;
  onDragStart: (e: React.DragEvent, orderId: number) => void;
  onDrop: (colId: string) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const getItems = (orderId: number) => allItems.filter(i => i.order_id === orderId);

  return (
    <div className="flex flex-col min-h-0">
      <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl border-t-2 border-x border-b border-border ${col.topBorder} ${col.headerBg} mb-3`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${col.dot}`} />
          <h2 className="font-bold text-sm text-foreground">{col.title}</h2>
        </div>
        <span className="text-xs font-bold text-muted-foreground bg-background/70 px-2 py-0.5 rounded-full border border-border/50">
          {orders.length}
        </span>
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={() => { setIsDragOver(false); onDrop(col.id); }}
        className={`
          flex-1 min-h-[120px] rounded-xl border-2 border-dashed p-2 space-y-2.5 overflow-y-auto
          transition-colors duration-150
          ${isDragOver
            ? `${col.dropActiveBg} border-opacity-100`
            : "border-border/30 bg-secondary/15"
          }
        `}
      >
        {orders.length === 0 && !isDragOver && (
          <div className="h-full min-h-[80px] flex items-center justify-center text-xs text-muted-foreground/30 font-medium">
            {col.emptyText}
          </div>
        )}
        {isDragOver && orders.length === 0 && (
          <div className="h-full min-h-[80px] flex items-center justify-center text-xs font-semibold text-primary/60">
            Taruh di sini →
          </div>
        )}
        {orders.map(order => (
          <OrderCard
            key={order.id}
            order={order}
            items={getItems(order.id!)}
            isDragging={draggingId === order.id}
            onDragStart={onDragStart}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function ProductionBoard() {
  const [draggingId, setDraggingId] = useState<number | null>(null);

  const orders   = useLiveQuery(() => db.orders.filter(o => !o.is_void && o.status !== "delivered").toArray()) ?? [];
  const allItems = useLiveQuery(() => db.order_items.toArray()) ?? [];

  const handleDragStart = (e: React.DragEvent, orderId: number) => {
    setDraggingId(orderId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("orderId", String(orderId));
  };

  const handleDrop = async (colId: string) => {
    if (draggingId === null) return;
    const order = orders.find(o => o.id === draggingId);
    if (order && order.status !== colId) await updateOrderStatus(draggingId, colId);
    setDraggingId(null);
  };

  const getColumnOrders = (colId: string) =>
    orders
      .filter(o => o.status === colId)
      .sort((a, b) =>
        new Date(a.ready_date || a.created_at).getTime() -
        new Date(b.ready_date || b.created_at).getTime()
      );

  const totalActive = orders.filter(o => o.status !== "delivered").length;

  return (
    <div
      className="flex flex-col gap-5 animate-in fade-in duration-500"
      onDragEnd={() => setDraggingId(null)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Papan Produksi</h1>
          <p className="text-muted-foreground mt-1">
            Seret kartu pesanan antar kolom untuk mengubah status.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {totalActive > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>{totalActive} pesanan aktif</span>
            </div>
          )}
          <div className="flex items-center gap-4 text-xs text-muted-foreground border border-border/40 rounded-lg px-3 py-1.5 bg-secondary/30">
            <span className="flex items-center gap-1.5">🏪 <span>Ambil Sendiri</span></span>
            <span className="w-px h-3 bg-border" />
            <span className="flex items-center gap-1.5">🛵 <span>Diantar (Ojol)</span></span>
          </div>
        </div>
      </div>

      <div className="pb-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {COLUMNS.map(col => (
            <KanbanColumn
              key={col.id}
              col={col}
              orders={getColumnOrders(col.id)}
              allItems={allItems}
              draggingId={draggingId}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
