import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import {
  Coffee, LayoutDashboard, ShoppingCart, Package,
  ClipboardList, KanbanSquare, BarChart3, Settings,
  CalendarClock, MoreHorizontal, X,
} from "lucide-react";

const bottomNav = [
  { title: "Dashboard", url: "/",          icon: LayoutDashboard },
  { title: "Kasir",     url: "/cashier",    icon: ShoppingCart },
  { title: "Pesanan",   url: "/orders",     icon: ClipboardList },
  { title: "Produksi",  url: "/production", icon: KanbanSquare },
  { title: "Lainnya",   url: null,          icon: MoreHorizontal },
];

const moreMenu = [
  { title: "Jadwal Produksi", url: "/schedule",  icon: CalendarClock },
  { title: "Laporan",         url: "/reports",   icon: BarChart3 },
  { title: "Produk",          url: "/products",  icon: Package },
  { title: "Pengaturan Toko", url: "/settings",  icon: Settings },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [showMore, setShowMore] = useState(false);
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "4rem",
  } as React.CSSProperties;

  return (
    <SidebarProvider style={style}>
      <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-primary/30">
        {/* Sidebar — hidden on mobile */}
        <div className="hidden md:block">
          <AppSidebar />
        </div>

        <div className="flex flex-col flex-1 w-full min-w-0">
          {/* Header */}
          <header className="h-14 md:h-16 flex items-center justify-between px-4 md:px-6 border-b border-border bg-card/50 backdrop-blur-sm z-10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="hidden md:block">
                <SidebarTrigger className="hover:bg-secondary rounded-lg p-2 transition-colors" />
              </div>
              <div className="flex items-center gap-2">
                <Coffee size={18} className="text-primary" />
                <span className="font-display font-bold text-foreground">Lumina POS</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-sm font-medium border border-border">
                AD
              </div>
            </div>
          </header>

          {/* Main content — extra bottom padding on mobile for bottom nav */}
          <main className="flex-1 overflow-y-auto bg-background p-3 md:p-6 lg:p-8 pb-36 md:pb-8">
            <div className="max-w-7xl mx-auto w-full h-full">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Bottom nav — mobile only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border flex items-stretch" style={{paddingBottom: "env(safe-area-inset-bottom)"}}>
        {bottomNav.map(item => {
          const isActive = item.url ? location === item.url : moreMenu.some(m => m.url === location);
          if (!item.url) {
            return (
              <button
                key="more"
                onClick={() => setShowMore(true)}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <item.icon size={20} className={isActive ? "text-primary" : "text-muted-foreground"} />
                <span>{item.title}</span>
              </button>
            );
          }
          return (
            <Link
              key={item.url}
              href={item.url}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground active:text-foreground"
              }`}
            >
              <item.icon size={20} className={isActive ? "text-primary" : "text-muted-foreground"} />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>

      {/* More drawer */}
      {showMore && (
        <div className="md:hidden fixed inset-0 z-[60] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowMore(false)} />
          <div className="relative bg-card border-t border-border rounded-t-2xl p-4 pb-8 space-y-1">
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-sm">Menu Lainnya</p>
              <button onClick={() => setShowMore(false)} className="h-8 w-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-secondary">
                <X size={16} />
              </button>
            </div>
            {moreMenu.map(item => (
              <Link
                key={item.url}
                href={item.url}
                onClick={() => setShowMore(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  location === item.url
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-foreground hover:bg-secondary"
                }`}
              >
                <item.icon size={18} className={location === item.url ? "text-primary" : "text-muted-foreground"} />
                <span className="text-sm font-medium">{item.title}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </SidebarProvider>
  );
}
