import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ClipboardList,
  KanbanSquare,
  BarChart3,
  Coffee,
  Settings,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard",       url: "/",           icon: LayoutDashboard },
  { title: "Kasir",           url: "/cashier",     icon: ShoppingCart },
  { title: "Produk",          url: "/products",    icon: Package },
  { title: "Pesanan",         url: "/orders",      icon: ClipboardList },
  { title: "Papan Produksi",  url: "/production",  icon: KanbanSquare },
  { title: "Laporan",         url: "/reports",     icon: BarChart3 },
  { title: "Pengaturan Toko", url: "/settings",    icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar className="border-r border-border bg-sidebar">
      <SidebarHeader className="h-16 flex items-center px-6 border-b border-border">
        <div className="flex items-center gap-3 w-full">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
            <Coffee size={18} strokeWidth={2.5} />
          </div>
          <span className="font-display font-bold text-lg tracking-wide text-foreground">
            Lumina POS
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground font-medium mb-2 px-2 text-xs uppercase tracking-wider">
            Aplikasi
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {navItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={`
                        h-11 rounded-xl px-4 transition-all duration-200
                        ${isActive
                          ? 'bg-primary/10 text-primary font-medium hover:bg-primary/15'
                          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                        }
                      `}
                    >
                      <Link href={item.url} className="flex items-center gap-3">
                        <item.icon size={18} className={isActive ? "text-primary" : "text-muted-foreground"} />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
