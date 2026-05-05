import React from 'react';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  Gem, 
  ShoppingCart, 
  Users, 
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { auth, logout } from '../lib/firebase';
import { View } from '../types';
import { cn } from '../lib/utils';

interface LayoutProps {
  children?: React.ReactNode;
  activeView: View;
  onViewChange: (view: View) => void;
}

export function Layout({ children, activeView, onViewChange }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const user = auth.currentUser;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventory', icon: Gem },
    { id: 'sales', label: 'Sales', icon: ShoppingCart },
    { id: 'contacts', label: 'Contacts', icon: Users },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-brand-bg text-brand-ink">
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-brand-border bg-brand-surface sticky top-0 z-50">
        <h1 className="font-serif italic text-xl font-bold text-brand-accent">Aakarshan Manager</h1>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-brand-accent">
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-brand-ink/40 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-72 md:relative md:w-64 flex flex-col bg-brand-surface border-r border-brand-border transition-transform duration-300 ease-in-out md:translate-x-0 overflow-y-auto",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-8">
          <h1 className="font-serif italic text-3xl font-medium text-brand-accent tracking-tight leading-none">Aakarshan</h1>
          <p className="text-[10px] uppercase tracking-widest text-brand-muted mt-2 font-medium">Boutique Admin</p>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onViewChange(item.id as View);
                setIsMobileMenuOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-2xl transition-all duration-300",
                activeView === item.id 
                  ? "bg-brand-accent text-white shadow-md shadow-brand-accent/20" 
                  : "text-brand-muted hover:bg-brand-accent/5 hover:text-brand-ink"
              )}
            >
              <item.icon size={18} className={activeView === item.id ? "opacity-100" : "opacity-40"} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-brand-border">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-brand-accent/10 flex items-center justify-center text-brand-accent font-bold shadow-inner">
              {user?.displayName?.[0] || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate text-brand-ink">{user?.displayName || 'Admin'}</p>
              <p className="text-[10px] text-brand-muted truncate uppercase tracking-tighter">{user?.email}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600/70 hover:bg-red-50 rounded-2xl transition-all"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-12 overflow-x-hidden">
        <motion.div
          key={activeView}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
