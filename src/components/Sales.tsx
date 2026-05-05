import React from 'react';
import { ShoppingBag, ArrowRight, Calendar, User, IndianRupee, Search } from 'lucide-react';
import { Product, Contact, Sale } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { collection, addDoc, serverTimestamp, updateDoc, doc, runTransaction } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

import { type User } from 'firebase/auth';

interface SalesProps {
  sales: Sale[];
  products: Product[];
  customers: Contact[];
  user: User;
}

export function Sales({ sales, products, customers, user }: SalesProps) {
  const [isRecording, setIsRecording] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');

  const inStockProducts = products.filter(p => p.status === 'In Stock');

  async function handleRecordSale(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const productId = formData.get('productId') as string;
    const customerId = formData.get('customerId') as string;
    const product = products.find(p => p.id === productId);
    const customer = customers.find(c => c.id === customerId);

    if (!product || !customer) return;

    try {
      // Use transaction to ensure both documents are updated atomically
      await runTransaction(db, async (transaction) => {
        const productRef = doc(db, 'inventory', productId);
        const saleRef = doc(collection(db, 'sales'));

        transaction.update(productRef, { status: 'Sold' });
        transaction.set(saleRef, {
          userId: user.uid,
          productId,
          productName: product.name,
          customerId,
          customerName: customer.name,
          retailPrice: Number(formData.get('retailPrice')),
          costAtSale: product.cost,
          saleDate: formData.get('saleDate') as string,
          createdAt: serverTimestamp(),
        });
      });
      
      setIsRecording(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sales');
    }
  }

  const filteredSales = sales.filter(s => 
    s.productName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-brand-border pb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif italic text-brand-accent leading-none">Aakarshan Sales</h1>
          <p className="text-[10px] md:text-xs text-brand-muted mt-2 font-medium tracking-widest uppercase">Transaction Ledger</p>
        </div>
        <button 
          onClick={() => setIsRecording(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-brand-accent text-white px-8 py-3 rounded-full font-bold text-[11px] uppercase tracking-widest hover:scale-105 transition-all shadow-lg"
        >
          <ShoppingBag size={16} />
          Record Sale
        </button>
      </header>

      {isRecording && (
        <div className="fixed inset-0 bg-brand-ink/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-2xl font-bold">Record Transaction</h3>
              <button onClick={() => setIsRecording(false)} className="opacity-40 hover:opacity-100 transition-opacity"><ArrowRight className="rotate-45" /></button>
            </div>
            <form onSubmit={handleRecordSale} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Select Product</label>
                <select required name="productId" className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5">
                  <option value="">Choose an item...</option>
                  {inStockProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({formatCurrency(p.cost)} cost)</option>
                  ))}
                  {inStockProducts.length === 0 && <option disabled>No items in stock</option>}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Customer</label>
                <select required name="customerId" className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5">
                  <option value="">Select customer...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  {customers.length === 0 && <option disabled>No customers found</option>}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Retail Price (INR)</label>
                  <input required type="number" step="0.01" name="retailPrice" className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" placeholder="0.00" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Sale Date</label>
                  <input required type="date" name="saleDate" defaultValue={new Date().toISOString().split('T')[0]} className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" />
                </div>
              </div>
              <button type="submit" className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-xs mt-4">Confirm Sale</button>
            </form>
          </div>
        </div>
      )}

      {/* List */}
      <div className="bg-white p-4 rounded-3xl border border-brand-ink/5 shadow-sm">
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-20" size={18} />
          <input 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-brand-bg/50 rounded-xl text-sm border-none focus:ring-1 ring-brand-accent/20" 
            placeholder="Filter sales by product or customer..." 
          />
        </div>

        <div className="space-y-6">
          {filteredSales.map((sale) => (
            <div key={sale.id} className="flex flex-col lg:flex-row lg:items-center justify-between p-6 sm:p-8 bg-brand-surface/30 rounded-[2rem] border border-brand-border group hover:border-brand-accent/30 transition-all gap-6">
              <div className="flex items-center gap-4 sm:gap-6">
                <div className="shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded-2xl sm:rounded-[1.5rem] bg-white border border-brand-border flex items-center justify-center text-brand-accent shadow-sm">
                  <ShoppingBag size={20} className="sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h4 className="font-serif italic text-lg sm:text-xl font-medium">{sale.productName}</h4>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                      <User size={12} /> {sale.customerName}
                    </span>
                    <span className="hidden sm:block w-1 h-1 rounded-full bg-brand-border" />
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                      <Calendar size={12} /> {sale.saleDate}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 lg:flex lg:items-center gap-8 lg:gap-12 text-left lg:text-right border-t lg:border-t-0 pt-6 lg:pt-0 border-brand-border/30">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-muted mb-2">Sale Price</p>
                  <p className="text-xl sm:text-2xl font-light text-brand-ink">{formatCurrency(sale.retailPrice)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent mb-2">Net Profit</p>
                  <p className="text-xl sm:text-2xl font-semibold text-brand-accent">{formatCurrency(sale.retailPrice - sale.costAtSale)}</p>
                </div>
              </div>
            </div>
          ))}
          {filteredSales.length === 0 && (
            <div className="py-20 text-center opacity-30 italic text-sm">No sales records found</div>
          )}
        </div>
      </div>
    </div>
  );
}
