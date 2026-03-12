import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Coffee } from "lucide-react";

export function AppLayout({ children }: { children: ReactNode }) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "4rem",
  } as React.CSSProperties;

  return (
    <SidebarProvider style={style}>
      <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-primary/30">
        <AppSidebar />
        <div className="flex flex-col flex-1 w-full min-w-0">
          <header className="h-16 flex items-center justify-between px-6 border-b border-border bg-card/50 backdrop-blur-sm z-10 shrink-0">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-secondary rounded-lg p-2 transition-colors" />
              <div className="md:hidden flex items-center gap-2">
                <Coffee size={18} className="text-primary" />
                <span className="font-display font-bold text-foreground">Lumina POS</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-sm font-medium border border-border">
                AD
              </div>
            </div>
          </header>
          
          <main className="flex-1 overflow-auto bg-background p-4 md:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto w-full h-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
