import React from 'react';
import { Plus, Search, Filter, MoreVertical, Trash2, Edit2 } from 'lucide-react';
import { Product, Contact } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { collection, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

interface InventoryProps {
  products: Product[];
  wholesalers: Contact[];
}

export function Inventory({ products, wholesalers }: InventoryProps) {
  const [isAdding, setIsAdding] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState<'All' | 'In Stock' | 'Sold'>('All');

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         p.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'All' || p.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  async function handleAddProduct(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const wholesalerId = formData.get('wholesalerId') as string;
    const wholesaler = wholesalers.find(w => w.id === wholesalerId);

    const productData = {
      name: formData.get('name') as string,
      category: formData.get('category') as string,
      wholesalerId,
      wholesalerName: wholesaler?.name || 'Unknown',
      cost: Number(formData.get('cost')),
      purchaseDate: formData.get('purchaseDate') as string,
      status: 'In Stock',
      createdAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, 'inventory'), productData);
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'inventory');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      await deleteDoc(doc(db, 'inventory', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `inventory/${id}`);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-brand-border pb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif italic text-brand-accent leading-none">Aakarshan Inventory</h1>
          <p className="text-[10px] md:text-xs text-brand-muted mt-2 font-medium tracking-widest uppercase">Collection Management</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-brand-accent text-white px-8 py-3 rounded-full font-bold text-[11px] uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-brand-accent/20"
        >
          <Plus size={16} />
          Add Piece
        </button>
      </header>

      {isAdding && (
        <div className="fixed inset-0 bg-brand-ink/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-2xl font-bold">New Inventory Item</h3>
              <button onClick={() => setIsAdding(false)} className="opacity-40 hover:opacity-100 transition-opacity"><Plus className="rotate-45" /></button>
            </div>
            <form onSubmit={handleAddProduct} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Product Name</label>
                <input required name="name" className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5 focus:outline-brand-accent" placeholder="e.g. Diamond Solitaire Ring" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Category</label>
                  <input required name="category" className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" placeholder="e.g. Ring" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Wholesaler</label>
                  <select required name="wholesalerId" className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5">
                    {wholesalers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    {wholesalers.length === 0 && <option disabled>No wholesalers found</option>}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Cost (INR)</label>
                  <input required type="number" step="0.01" name="cost" className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" placeholder="0.00" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Purchase Date</label>
                  <input required type="date" name="purchaseDate" defaultValue={new Date().toISOString().split('T')[0]} className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" />
                </div>
              </div>
              <button type="submit" className="w-full bg-brand-accent text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-xs mt-4 shadow-lg shadow-brand-accent/20">Save Product</button>
            </form>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-3xl border border-brand-ink/5 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-20" size={18} />
          <input 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-brand-bg/50 rounded-xl text-sm focus:outline-none transition-all focus:bg-white focus:ring-1 ring-brand-accent/20" 
            placeholder="Search products, categories..." 
          />
        </div>
        <div className="flex gap-2 p-1 bg-brand-bg/50 rounded-xl overflow-x-auto">
          {(['All', 'In Stock', 'Sold'] as const).map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={cn(
                "px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all whitespace-nowrap",
                filterStatus === status ? "bg-white text-brand-ink shadow-sm" : "opacity-40 hover:opacity-100"
              )}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Grid for Mobile, Table for Desktop */}
      <div className="md:hidden space-y-4">
        {filteredProducts.map((p) => (
          <div key={p.id} className="bg-white p-6 rounded-3xl border border-brand-border shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="font-semibold text-brand-ink">{p.name}</h4>
                <p className="text-[10px] text-brand-muted uppercase tracking-widest mt-1">{p.category}</p>
              </div>
              <span className={cn(
                "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest",
                p.status === 'In Stock' ? "bg-brand-accent/10 text-brand-accent" : "bg-brand-muted/10 text-brand-muted"
              )}>
                {p.status}
              </span>
            </div>
            
            <div className="flex justify-between items-end border-t border-brand-surface pt-4">
              <div>
                <p className="text-[9px] text-brand-muted uppercase tracking-wider mb-1">Wholesaler</p>
                <p className="text-xs font-medium">{p.wholesalerName}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-brand-muted uppercase tracking-wider mb-1">Cost</p>
                <p className="text-lg font-mono font-bold text-brand-accent">{formatCurrency(p.cost)}</p>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-brand-surface">
              <button 
                onClick={() => handleDelete(p.id)}
                className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-red-600 bg-red-50 rounded-xl"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          </div>
        ))}
        {filteredProducts.length === 0 && (
          <div className="py-12 text-center opacity-30 italic text-sm">No items found</div>
        )}
      </div>

      <div className="hidden md:block bg-white rounded-[2rem] border border-brand-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-brand-surface text-brand-muted text-[11px] uppercase tracking-[0.2em]">
                <th className="px-8 py-5 font-semibold">Item Details</th>
                <th className="px-8 py-5 font-semibold">Category</th>
                <th className="px-8 py-5 font-semibold">Wholesaler</th>
                <th className="px-8 py-5 font-semibold text-right">Cost</th>
                <th className="px-8 py-5 font-semibold text-center">Status</th>
                <th className="px-8 py-5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-surface">
              {filteredProducts.map((p) => (
                <tr key={p.id} className="group hover:bg-brand-surface/40 transition-colors">
                  <td className="px-8 py-6">
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-[10px] text-brand-muted mt-1 uppercase tracking-widest">Entry: {p.purchaseDate}</p>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-xs text-brand-muted italic">{p.category}</span>
                  </td>
                  <td className="px-8 py-6 text-sm">{p.wholesalerName}</td>
                  <td className="px-8 py-6 text-sm font-mono text-right">{formatCurrency(p.cost)}</td>
                  <td className="px-8 py-6 text-center">
                    <span className={cn(
                      "inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest",
                      p.status === 'In Stock' ? "text-brand-accent" : "text-brand-muted opacity-60"
                    )}>
                      {p.status === 'In Stock' && <span className="w-2 h-2 rounded-full bg-brand-accent" />}
                      {p.status}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button onClick={() => handleDelete(p.id)} className="p-2 text-brand-muted hover:text-red-600 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center opacity-30 italic text-sm">No items found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
