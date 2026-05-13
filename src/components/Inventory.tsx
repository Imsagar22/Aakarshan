import React from 'react';
import { Plus, Search, Filter, MoreVertical, Trash2, Edit2, Download } from 'lucide-react';
import { Product, Contact } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { collection, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

import { type User } from 'firebase/auth';

interface InventoryProps {
  products: Product[];
  wholesalers: Contact[];
  user: User;
}

export function Inventory({ products, wholesalers, user }: InventoryProps) {
  const [isAdding, setIsAdding] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState<'All' | 'In Stock' | 'Sold'>('All');

  const filteredProducts = products
    .filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           p.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'All' || p.status === filterStatus;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const aTime = (a.createdAt as any)?.seconds || 0;
      const bTime = (b.createdAt as any)?.seconds || 0;
      return bTime - aTime;
    });

  async function handleAddProduct(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const wholesalerId = formData.get('wholesalerId') as string;
    const wholesaler = wholesalers.find(w => w.id === wholesalerId);

    const productData = {
      userId: user.uid,
      name: formData.get('name') as string,
      category: formData.get('category') as string,
      wholesalerId,
      wholesalerName: wholesaler?.name || 'Unknown',
      cost: Number(formData.get('cost')),
      quantity: Number(formData.get('quantity')),
      purchaseDate: formData.get('purchaseDate') as string,
      status: Number(formData.get('quantity')) > 0 ? 'In Stock' : 'Sold',
      createdAt: serverTimestamp(),
    };

    console.log('Attempting to add product:', productData);
    try {
      const docRef = await addDoc(collection(db, 'inventory'), productData);
      console.log('Product added successfully with ID:', docRef.id);
      setIsAdding(false);
    } catch (error) {
      console.error('Error adding product:', error);
      handleFirestoreError(error, OperationType.WRITE, 'inventory');
    }
  }

  async function handleEditProduct(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingProduct) return;

    const formData = new FormData(e.currentTarget);
    const wholesalerId = formData.get('wholesalerId') as string;
    const wholesaler = wholesalers.find(w => w.id === wholesalerId);

    const productData = {
      name: formData.get('name') as string,
      category: formData.get('category') as string,
      wholesalerId,
      wholesalerName: wholesaler?.name || 'Unknown',
      cost: Number(formData.get('cost')),
      quantity: Number(formData.get('quantity')),
      purchaseDate: formData.get('purchaseDate') as string,
      status: Number(formData.get('quantity')) > 0 ? 'In Stock' : 'Sold',
    };

    try {
      await updateDoc(doc(db, 'inventory', editingProduct.id), productData);
      setEditingProduct(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `inventory/${editingProduct.id}`);
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

  function handleExportCSV() {
    const headers = ['Name', 'Category', 'Wholesaler', 'Cost', 'Quantity', 'Status', 'Purchase Date'];
    const rows = filteredProducts.map(p => [
      p.name,
      p.category,
      p.wholesalerName,
      p.cost,
      p.quantity || 0,
      p.status,
      p.purchaseDate
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `inventory_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-brand-border pb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif italic text-brand-accent leading-none">Aakarshan Inventory</h1>
          <p className="text-[10px] md:text-xs text-brand-muted mt-2 font-medium tracking-widest uppercase">Collection Management</p>
        </div>
        <div className="w-full sm:w-auto flex items-center gap-3">
          <button 
            onClick={handleExportCSV}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-brand-border text-brand-ink px-6 py-3 rounded-full font-bold text-[11px] uppercase tracking-widest hover:bg-brand-surface transition-all"
          >
            <Download size={16} />
            Export CSV
          </button>
          <button 
            onClick={() => setIsAdding(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-brand-accent text-white px-8 py-3 rounded-full font-bold text-[11px] uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-brand-accent/20"
          >
            <Plus size={16} />
            Add Piece
          </button>
        </div>
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
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Quantity</label>
                  <input required type="number" min="0" name="quantity" defaultValue="1" className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Purchase Date</label>
                <input required type="date" name="purchaseDate" defaultValue={new Date().toISOString().split('T')[0]} className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" />
              </div>
              <button type="submit" className="w-full bg-brand-accent text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-xs mt-4 shadow-lg shadow-brand-accent/20">Save Product</button>
            </form>
          </div>
        </div>
      )}

      {editingProduct && (
        <div className="fixed inset-0 bg-brand-ink/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-2xl font-bold">Edit Inventory Item</h3>
              <button onClick={() => setEditingProduct(null)} className="opacity-40 hover:opacity-100 transition-opacity"><Plus className="rotate-45" /></button>
            </div>
            <form onSubmit={handleEditProduct} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Product Name</label>
                <input required name="name" defaultValue={editingProduct.name} className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5 focus:outline-brand-accent" placeholder="e.g. Diamond Solitaire Ring" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Category</label>
                  <input required name="category" defaultValue={editingProduct.category} className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" placeholder="e.g. Ring" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Wholesaler</label>
                  <select required name="wholesalerId" defaultValue={editingProduct.wholesalerId} className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5">
                    {wholesalers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    {wholesalers.length === 0 && <option disabled>No wholesalers found</option>}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Cost (INR)</label>
                  <input required type="number" step="0.01" name="cost" defaultValue={editingProduct.cost} className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" placeholder="0.00" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Quantity</label>
                  <input required type="number" min="0" name="quantity" defaultValue={editingProduct.quantity} className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Purchase Date</label>
                <input required type="date" name="purchaseDate" defaultValue={editingProduct.purchaseDate} className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" />
              </div>
              <button type="submit" className="w-full bg-brand-accent text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-xs mt-4 shadow-lg shadow-brand-accent/20">Update Product</button>
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
                <p className="text-[9px] text-brand-muted uppercase tracking-wider mb-1">Wholesaler / Qty</p>
                <p className="text-xs font-medium">{p.wholesalerName} <span className="opacity-50">({p.quantity || 0} left)</span></p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-brand-muted uppercase tracking-wider mb-1">Cost</p>
                <p className="text-lg font-mono font-bold text-brand-accent">{formatCurrency(p.cost)}</p>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-brand-surface">
              <button 
                onClick={() => setEditingProduct(p)}
                className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-accent bg-brand-accent/5 rounded-xl"
              >
                <Edit2 size={14} />
                Edit
              </button>
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
                <th className="px-8 py-5 font-semibold text-center">Stock</th>
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
                  <td className="px-8 py-6 text-center text-sm font-bold">{p.quantity || 0}</td>
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
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditingProduct(p)} className="p-2 text-brand-muted hover:text-brand-accent transition-colors">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="p-2 text-brand-muted hover:text-red-600 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
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
