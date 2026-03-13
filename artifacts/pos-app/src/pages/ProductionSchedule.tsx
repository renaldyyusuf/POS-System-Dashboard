import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, updateOrderStatus, type Order, type OrderItem } from "@/database/db";
import { format, isToday, isTomorrow, isYesterday, startOfDay } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  ChevronDown, ChevronRight, Clock, Package, Users, ListChecks, CalendarDays, ChefHat,
} from "lucide-react";

// ── Column config ──────────────────────────────────────────────────────────

interface KanbanColumn {
  id: string;
  label: string;
  dot: string;
  headerBg: string;
  topBorder: string;
  dropActiveBg: string;
  emptyText: string;
}

const COLUMNS: KanbanColumn[] = [
  {
    id: "pending",
    label: "Menunggu",
    dot: "bg-amber-400",
    headerBg: "bg-amber-500/10",
    topBorder: "border-t-amber-400",
    dropActiveBg: "bg-amber-500/5 border-amber-400/50",
    emptyText: "Tidak ada pesanan",
  },
  {
    id: "in-progress",
    label: "Diproses",
    dot: "bg-blue-400",
    headerBg: "bg-blue-500/10",
    topBorder: "border-t-blue-400",
    dropActiveBg: "bg-blue-500/5 border-blue-400/50",
    emptyText: "Belum ada yang diproses",
  },
  {
    id: "ready",
    label: "Siap",
    dot: "bg-emerald-400",
    headerBg: "bg-emerald-500/10",
    topBorder: "border-t-emerald-400",
    dropActiveBg: "bg-emerald-500/5 border-emerald-400/50",
    emptyText: "Belum ada yang siap",
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function getTimeSlotKey(isoDate: string): string {
  return format(new Date(isoDate), "HH:00");
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  if (isToday(d)) return `Hari Ini — ${format(d, "d MMMM yyyy", { locale: idLocale })}`;
  if (isTomorrow(d)) return `Besok — ${format(d, "d MMMM yyyy", { locale: idLocale })}`;
  if (isYesterday(d)) return `Kemarin — ${format(d, "d MMMM yyyy", { locale: idLocale })}`;
  return format(d, "EEEE, d MMMM yyyy", { locale: idLocale });
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
  const readyTime = format(new Date(order.ready_date || order.created_at), "HH:mm");

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, order.id!)}
      className={`
        bg-card border border-border rounded-xl p-3 space-y-2.5
        cursor-grab active:cursor-grabbing select-none
        transition-all duration-150
        ${isDragging
          ? "opacity-30 scale-[0.97] rotate-1"
          : "hover:shadow-lg hover:shadow-black/30 hover:border-border/80 shadow-sm shadow-black/20"
        }
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-xs font-mono font-bold text-primary/80">ORD-{order.id}</span>
          <p className="font-semibold text-sm text-foreground mt-0.5 leading-snug truncate">
            {order.customer_name}
          </p>
        </div>
        <span className="text-lg leading-none mt-0.5 shrink-0" title={isOjol ? "Ojol Delivery" : "Ambil Sendiri"}>
          {isOjol ? "🛵" : "🏪"}
        </span>
      </div>

      {/* Time + fulfillment badge */}
      <div className="flex items-center gap-1.5">
        <Clock size={11} className="text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground">
          Siap pukul <span className="font-bold text-foreground">{readyTime}</span>
        </span>
        <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
          isOjol
            ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
            : "bg-blue-500/10 text-blue-400 border-blue-500/20"
        }`}>
          {isOjol ? "Ojol" : "Ambil Sendiri"}
        </span>
      </div>

      {/* Items */}
      {items.length > 0 && (
        <div className="border-t border-border/40 pt-2 space-y-0.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Items
          </p>
          {items.slice(0, 4).map((item, i) => (
            <div key={i} className="flex gap-2 text-xs">
              <span className="font-bold text-primary/70 w-6 shrink-0 tabular-nums text-right">
                {item.qty}×
              </span>
              <span className="text-muted-foreground truncate">{item.product_name}</span>
            </div>
          ))}
          {items.length > 4 && (
            <p className="text-xs text-muted-foreground/40 pl-8">+{items.length - 4} more</p>
          )}
        </div>
      )}

      {/* Delivery address */}
      {isOjol && order.delivery_address && (
        <div className="flex gap-1.5 items-start bg-orange-500/5 border border-orange-500/15 rounded-lg px-2 py-1.5">
          <span className="text-xs text-muted-foreground leading-relaxed line-clamp-1">
            📍 {order.delivery_address}
          </span>
        </div>
      )}
    </div>
  );
}


// ── Day Item Summary ───────────────────────────────────────────────────────

function DayItemSummary({ dayOrders, allItems }: { dayOrders: Order[]; allItems: OrderItem[] }) {
  const [open, setOpen] = useState(false);

  // Aggregate all items for this day's orders
  const itemMap: Record<string, number> = {};
  for (const order of dayOrders) {
    const items = allItems.filter(i => i.order_id === order.id);
    for (const item of items) {
      itemMap[item.product_name] = (itemMap[item.product_name] ?? 0) + item.qty;
    }
  }
  const itemList = Object.entries(itemMap).sort((a, b) => b[1] - a[1]);
  if (itemList.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/60 bg-secondary/10 overflow-hidden">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/30 transition-colors group"
      >
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <ChefHat size={13} className="text-primary" />
          <span className="text-foreground">Rekap Produksi Hari Ini</span>
          <span className="text-muted-foreground/60">— {itemList.length} jenis produk · {itemList.reduce((s, [,q]) => s + q, 0)} item total</span>
        </div>
        <div className="ml-auto text-muted-foreground group-hover:text-foreground transition-colors">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-3 pt-1 border-t border-border/40 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mt-2">
            {itemList.map(([name, qty]) => (
              <div
                key={name}
                className="flex items-center justify-between gap-2 bg-card border border-border rounded-lg px-3 py-2"
              >
                <span className="text-xs text-muted-foreground truncate flex-1">{name}</span>
                <span className="text-sm font-bold text-primary tabular-nums shrink-0">×{qty}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Kanban Column ──────────────────────────────────────────────────────────

function KanbanColumn({
  col, orders, allItems, draggingId, onDragStart, onDrop,
}: {
  col: KanbanColumn;
  orders: Order[];
  allItems: OrderItem[];
  draggingId: number | null;
  onDragStart: (e: React.DragEvent, orderId: number) => void;
  onDrop: (colId: string) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const getItems = (orderId: number) => allItems.filter((i) => i.order_id === orderId);

  return (
    <div className="flex flex-col min-h-0">
      {/* Header */}
      <div className={`flex items-center justify-between px-3 py-2 rounded-xl border-t-2 border-x border-b border-border ${col.topBorder} ${col.headerBg} mb-2.5`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${col.dot}`} />
          <h3 className="font-bold text-xs text-foreground">{col.label}</h3>
        </div>
        <span className="text-xs font-bold text-muted-foreground bg-background/60 px-2 py-0.5 rounded-full border border-border/40">
          {orders.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={() => { setIsDragOver(false); onDrop(col.id); }}
        className={`
          flex-1 min-h-[120px] rounded-xl border-2 border-dashed p-2 space-y-2 overflow-y-auto
          transition-colors duration-150
          ${isDragOver
            ? `${col.dropActiveBg} border-opacity-100`
            : "border-border/25 bg-secondary/10"
          }
        `}
      >
        {orders.length === 0 && !isDragOver && (
          <div className="h-full min-h-[80px] flex items-center justify-center text-xs text-muted-foreground/30 font-medium">
            {col.emptyText}
          </div>
        )}
        {isDragOver && orders.length === 0 && (
          <div className="h-full min-h-[80px] flex items-center justify-center text-xs font-semibold text-primary/50">
            Drop di sini →
          </div>
        )}
        {orders.map((order) => (
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

// ── Time Slot Block ────────────────────────────────────────────────────────

function TimeSlotBlock({
  timeSlot, orders, allItems, draggingId, onDragStart, onDrop,
}: {
  timeSlot: string;
  orders: Order[];
  allItems: OrderItem[];
  draggingId: number | null;
  onDragStart: (e: React.DragEvent, orderId: number) => void;
  onDrop: (colId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const slotItems = allItems.filter((item) => orders.some((o) => o.id === item.order_id));
  const totalItems = slotItems.reduce((s, i) => s + i.qty, 0);
  const ojolCount = orders.filter((o) => o.fulfillment_method === "ojol").length;
  const pickupCount = orders.filter((o) => o.fulfillment_method === "pickup").length;

  const getColOrders = (colId: string) =>
    orders
      .filter((o) => o.status === colId)
      .sort(
        (a, b) =>
          new Date(a.ready_date || a.created_at).getTime() -
          new Date(b.ready_date || b.created_at).getTime()
      );

  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden shadow-lg shadow-black/15">
      {/* Slot header */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-4 px-5 py-3.5 bg-card/60 hover:bg-card/80 transition-colors border-b border-border/40 group"
      >
        {/* Time badge */}
        <div className="flex items-center gap-2.5 min-w-[90px]">
          <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Clock size={14} className="text-primary" />
          </div>
          <span className="font-display font-bold text-xl text-foreground tabular-nums">
            {timeSlot}
          </span>
        </div>

        {/* Summary pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary border border-border text-xs font-semibold text-muted-foreground">
            <Users size={11} />
            Orders: <span className="text-foreground ml-0.5">{orders.length}</span>
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary border border-border text-xs font-semibold text-muted-foreground">
            <ListChecks size={11} />
            Total Items: <span className="text-foreground ml-0.5">{totalItems}</span>
          </span>
          {ojolCount > 0 && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-xs font-semibold text-orange-400">
              🛵 {ojolCount} Ojol
            </span>
          )}
          {pickupCount > 0 && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-400">
              🏪 {pickupCount} Pickup
            </span>
          )}
        </div>

        {/* Chevron */}
        <div className="ml-auto text-muted-foreground group-hover:text-foreground transition-colors shrink-0">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </button>

      {/* Kanban board */}
      {expanded && (
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 min-h-[180px]">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                col={col}
                orders={getColOrders(col.id)}
                allItems={allItems}
                draggingId={draggingId}
                onDragStart={onDragStart}
                onDrop={onDrop}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function ProductionSchedule() {
  const [draggingId, setDraggingId] = useState<number | null>(null);

  const allOrders = useLiveQuery(() => db.orders.filter((o) => !o.is_void && o.status !== "delivered").toArray()) ?? [];
  const allItems = useLiveQuery(() => db.order_items.toArray()) ?? [];

  // Only show today and future orders
  const todayStart = startOfDay(new Date()).toISOString();
  const orders = allOrders.filter((o) => (o.ready_date || o.created_at) >= todayStart);

  // Group: day → timeSlot → orders[]
  const grouped: Record<string, Record<string, Order[]>> = {};
  for (const order of orders) {
    const dateRef = order.ready_date || order.created_at;
    const dayKey = format(new Date(dateRef), "yyyy-MM-dd");
    const slotKey = getTimeSlotKey(dateRef);
    if (!grouped[dayKey]) grouped[dayKey] = {};
    if (!grouped[dayKey][slotKey]) grouped[dayKey][slotKey] = [];
    grouped[dayKey][slotKey].push(order);
  }

  const sortedDays = Object.keys(grouped).sort();

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, orderId: number) => {
    setDraggingId(orderId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("orderId", String(orderId));
  };

  const handleDrop = async (colId: string) => {
    if (draggingId === null) return;
    const order = orders.find((o) => o.id === draggingId);
    if (order && order.status !== colId) {
      await updateOrderStatus(draggingId, colId);
    }
    setDraggingId(null);
  };

  const totalActive = orders.length;
  const totalToday = orders.filter((o) =>
    isToday(new Date(o.ready_date || o.created_at))
  ).length;

  return (
    <div
      className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
      onDragEnd={() => setDraggingId(null)}
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Jadwal Produksi</h1>
          <p className="text-muted-foreground mt-1">
            Pesanan dikelompokkan otomatis berdasarkan waktu siap. Seret kartu untuk mengubah status.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card text-sm">
            <CalendarDays size={14} className="text-primary" />
            <span className="text-muted-foreground">Hari ini:</span>
            <span className="font-bold text-foreground">{totalToday} pesanan</span>
          </div>
          {totalActive > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-500/20 bg-amber-500/10 text-sm">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
              <span className="font-semibold text-amber-400">{totalActive} pesanan aktif</span>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground border border-border/40 rounded-lg px-4 py-2.5 bg-secondary/20 w-fit flex-wrap">
        <span className="flex items-center gap-1.5">🏪 <span>Ambil Sendiri (Pickup)</span></span>
        <span className="w-px h-3 bg-border hidden sm:block" />
        <span className="flex items-center gap-1.5">🛵 <span>Diantar (Ojol)</span></span>
        <span className="w-px h-3 bg-border hidden sm:block" />
        <span className="opacity-50">Seret kartu antar kolom untuk ubah status</span>
      </div>

      {/* Schedule */}
      {sortedDays.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-muted-foreground">
          <div className="h-16 w-16 rounded-2xl bg-secondary/50 flex items-center justify-center border border-border">
            <Package size={28} className="opacity-30" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">Belum ada pesanan terjadwal</p>
            <p className="text-sm mt-1">Pesanan akan muncul otomatis setelah dibuat di halaman Kasir.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {sortedDays.map((dayKey) => {
            const daySlots = grouped[dayKey];
            const sortedSlots = Object.keys(daySlots).sort();
            const dayOrders = Object.values(daySlots).flat();
            const dayItemCount = allItems
              .filter((i) => dayOrders.some((o) => o.id === i.order_id))
              .reduce((s, i) => s + i.qty, 0);

            return (
              <div key={dayKey} className="space-y-3">
                {/* Day divider */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border/50" />
                  <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-border bg-secondary/40">
                    <CalendarDays size={13} className="text-primary" />
                    <span className="font-display font-bold text-sm text-foreground">
                      {formatDayLabel(dayKey)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      · {dayOrders.length} orders · {dayItemCount} items
                    </span>
                  </div>
                  <div className="h-px flex-1 bg-border/50" />
                </div>

                {/* Day item recap */}
                <DayItemSummary dayOrders={dayOrders} allItems={allItems} />

                {/* Time slot blocks */}
                <div className="space-y-3 pl-1">
                  {sortedSlots.map((slotKey) => (
                    <TimeSlotBlock
                      key={`${dayKey}-${slotKey}`}
                      timeSlot={slotKey}
                      orders={daySlots[slotKey]}
                      allItems={allItems}
                      draggingId={draggingId}
                      onDragStart={handleDragStart}
                      onDrop={handleDrop}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
