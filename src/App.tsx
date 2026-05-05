/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, loginWithGoogle, handleRedirectResult, handleFirestoreError, OperationType } from './lib/firebase';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Inventory } from './components/Inventory';
import { Sales } from './components/Sales';
import { Contacts } from './components/Contacts';
import { Product, Sale, Contact, View } from './types';
import { Gem } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function App() {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loginError, setLoginError] = React.useState<string | null>(null);
  const [showRedirectHelp, setShowRedirectHelp] = React.useState(false);
  const [activeView, setActiveView] = React.useState<View>('dashboard');
  
  const [products, setProducts] = React.useState<Product[]>([]);
  const [sales, setSales] = React.useState<Sale[]>([]);
  const [contacts, setContacts] = React.useState<Contact[]>([]);

  React.useEffect(() => {
    // Check for redirect result on initialization
    handleRedirectResult();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async (useRedirect = false) => {
    setLoginError(null);
    try {
      await loginWithGoogle(useRedirect);
    } catch (error: any) {
      setLoginError(error.message || 'Login failed');
      setShowRedirectHelp(true);
    }
  };

  React.useEffect(() => {
    if (!user) return;

    const unsubInventory = onSnapshot(
      query(collection(db, 'inventory'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'inventory')
    );

    const unsubSales = onSnapshot(
      query(collection(db, 'sales'), orderBy('saleDate', 'desc')),
      (snapshot) => {
        setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'sales')
    );

    const unsubContacts = onSnapshot(
      query(collection(db, 'contacts'), orderBy('name', 'asc')),
      (snapshot) => {
        setContacts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contact)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'contacts')
    );

    return () => {
      unsubInventory();
      unsubSales();
      unsubContacts();
    };
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.3, 1, 0.3] }} 
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-brand-accent"
        >
          <Gem size={64} />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen grid lg:grid-cols-2 bg-brand-bg relative overflow-hidden">
        {/* Left Side: Branding */}
        <div className="hidden lg:flex flex-col justify-between p-16 bg-brand-ink text-[#FDFBF7] relative">
          <div className="relative z-10">
            <h1 className="font-serif italic text-5xl font-medium tracking-tight mb-4">Aakarshan</h1>
            <p className="text-xs uppercase tracking-[0.4em] font-medium opacity-40">Fine Jewelry Management</p>
          </div>
          
          <div className="relative z-10 w-full max-w-sm">
            <h2 className="font-serif italic text-4xl font-light leading-relaxed mb-6">
              Precision in every gram, <br />
              <span className="opacity-70">clarity in every sale.</span>
            </h2>
          </div>

          <div className="absolute inset-0 opacity-10 pointer-events-none">
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-white/20 rounded-full" />
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-white/20 rounded-full" />
          </div>
        </div>

        {/* Right Side: Login */}
        <div className="flex flex-col items-center justify-center p-8 bg-brand-bg">
          <div className="w-full max-w-md space-y-12">
            <div className="text-center lg:text-left">
              <div className="lg:hidden flex justify-center mb-6">
                 <h1 className="font-serif text-4xl font-medium text-brand-accent italic">Aakarshan</h1>
              </div>
              <h3 className="text-3xl font-serif italic text-brand-ink">Welcome Back</h3>
              <p className="text-brand-muted mt-2 font-medium">Sign in to access your boutique dashboard</p>
            </div>

            <div className="space-y-4">
              <button 
                onClick={() => handleLogin(false)}
                className="w-full flex items-center justify-center gap-4 bg-brand-surface py-5 px-6 rounded-3xl border border-brand-border shadow-sm hover:shadow-md transition-all font-bold text-xs tracking-widest uppercase text-brand-ink"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                Sign in with Google
              </button>

              {showRedirectHelp && (
                <div className="text-center space-y-3">
                  <p className="text-[10px] text-brand-muted font-medium">Popup not loading? Try the alternative:</p>
                  <button 
                    onClick={() => handleLogin(true)}
                    className="w-full py-4 text-[10px] font-bold uppercase tracking-widest text-brand-accent border border-brand-accent/20 rounded-2xl hover:bg-brand-accent/5 transition-colors"
                  >
                    Use Redirect Sign-In
                  </button>
                </div>
              )}

              {loginError && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-[10px] font-bold uppercase tracking-widest text-center leading-relaxed">
                  {loginError}
                </div>
              )}
            </div>

            <div className="pt-12 text-center opacity-30">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em]">Crafted for Curators & Artisans</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderView = () => {
    switch (activeView) {
      case 'dashboard': return <Dashboard products={products} sales={sales} />;
      case 'inventory': return <Inventory products={products} wholesalers={contacts.filter(c => c.type === 'wholesaler')} />;
      case 'sales': return <Sales sales={sales} products={products} customers={contacts.filter(c => c.type === 'customer')} />;
      case 'contacts': return <Contacts contacts={contacts} />;
      default: return <Dashboard products={products} sales={sales} />;
    }
  };

  return (
    <Layout activeView={activeView} onViewChange={setActiveView}>
      <AnimatePresence mode="wait">
        {renderView()}
      </AnimatePresence>
    </Layout>
  );
}
