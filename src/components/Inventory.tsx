import React from 'react';
import { Plus, Search, Filter, MoreVertical, Trash2, Edit2, History as HistoryIcon, ArrowUpRight, ArrowDownRight, Package } from 'lucide-react';
import { Product, Contact, Sale, InventoryLog } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { collection, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, runTransaction } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

import { type User } from 'firebase/auth';

interface InventoryProps {
  products: Product[];
  wholesalers: Contact[];
  user: User;
  sales: Sale[];
  logs: InventoryLog[];
}

export function Inventory({ products, wholesalers, user, sales, logs }: InventoryProps) {
  const [isAdding, setIsAdding] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null);
  const [historyProductId, setHistoryProductId] = React.useState<string | null>(null);
  const [isAdjusting, setIsAdjusting] = React.useState<string | null>(null);
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
      status: 'In Stock',
      createdAt: serverTimestamp(),
    };

    console.log('Attempting to add product:', productData);
    try {
      const docRef = await addDoc(collection(db, 'inventory'), productData);
      
      // Log initial stock
      await addDoc(collection(db, 'inventory_logs'), {
        userId: user.uid,
        productId: docRef.id,
        type: 'restock',
        quantityChange: productData.quantity,
        note: 'Initial inventory added',
        date: productData.purchaseDate,
        createdAt: serverTimestamp(),
      });

      console.log('Product added successfully with ID:', docRef.id);
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'inventory');
    }
  }

  async function handleUpdateProduct(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingProduct) return;

    const formData = new FormData(e.currentTarget);
    const wholesalerId = formData.get('wholesalerId') as string;
    const wholesaler = wholesalers.find(w => w.id === wholesalerId);

    const updateData = {
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
      await updateDoc(doc(db, 'inventory', editingProduct.id), updateData);
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

  async function handleAdjustStock(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isAdjusting) return;

    const formData = new FormData(e.currentTarget);
    const type = formData.get('type') as 'restock' | 'adjustment';
    const change = Number(formData.get('quantityChange'));
    const note = formData.get('note') as string;
    const date = formData.get('date') as string;

    try {
      await runTransaction(db, async (transaction) => {
        const productRef = doc(db, 'inventory', isAdjusting);
        const productDoc = await transaction.get(productRef);
        if (!productDoc.exists()) throw new Error("Product not found");

        const currentQty = productDoc.data().quantity || 0;
        const newQty = Math.max(0, currentQty + change);

        transaction.update(productRef, {
          quantity: newQty,
          status: newQty > 0 ? 'In Stock' : 'Sold'
        });

        const logRef = doc(collection(db, 'inventory_logs'));
        transaction.set(logRef, {
          userId: user.uid,
          productId: isAdjusting,
          type,
          quantityChange: change,
          note,
          date,
          createdAt: serverTimestamp(),
        });
      });
      setIsAdjusting(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `inventory/${isAdjusting}`);
    }
  }

  const historyProduct = products.find(p => p.id === historyProductId);
  const productHistory = historyProductId ? [
    ...sales.filter(s => s.productId === historyProductId).map(s => ({
      id: s.id,
      date: s.saleDate,
      type: 'sale' as const,
      change: -(s.quantity || 1),
      note: `Sold to ${s.customerName}`,
      createdAt: s.createdAt
    })),
    ...logs.filter(l => l.productId === historyProductId).map(l => ({
      id: l.id,
      date: l.date,
      type: l.type,
      change: l.quantityChange,
      note: l.note,
      createdAt: l.createdAt
    }))
  ].sort((a, b) => {
    const aTime = (a.createdAt as any)?.seconds || 0;
    const bTime = (b.createdAt as any)?.seconds || 0;
    return bTime - aTime;
  }) : [];

  const totalInventoryValue = filteredProducts.reduce((sum, p) => sum + ((Number(p.cost) || 0) * (Number(p.quantity) || 0)), 0);
  const totalItems = filteredProducts.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);

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

      <div className="flex flex-col sm:flex-row gap-4 items-center bg-brand-surface/40 p-6 rounded-3xl border border-brand-border/40">
        <div className="flex-1">
          <p className="text-[10px] uppercase font-bold tracking-widest text-brand-muted mb-1">List Summary</p>
          <p className="text-sm font-medium text-brand-ink">Showing <span className="text-brand-accent font-bold">{filteredProducts.length}</span> types of pieces • <span className="text-brand-accent font-bold">{totalItems}</span> units in total</p>
        </div>
        <div className="h-px w-full sm:w-px sm:h-8 bg-brand-border/50" />
        <div className="text-center sm:text-right">
          <p className="text-[10px] uppercase font-bold tracking-widest text-brand-muted mb-1">Stock Value (@ Cost)</p>
          <p className="text-2xl font-serif italic text-brand-accent">{formatCurrency(totalInventoryValue)}</p>
        </div>
      </div>

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
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Quantity</label>
                  <input required type="number" min="1" name="quantity" defaultValue="1" className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Cost per unit (INR)</label>
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

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-brand-ink/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-2xl font-bold">Edit Product</h3>
              <button onClick={() => setEditingProduct(null)} className="opacity-40 hover:opacity-100 transition-opacity"><Plus className="rotate-45" /></button>
            </div>
            <form onSubmit={handleUpdateProduct} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Product Name</label>
                <input required name="name" defaultValue={editingProduct.name} className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5 focus:outline-brand-accent" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Category</label>
                  <input required name="category" defaultValue={editingProduct.category} className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Wholesaler</label>
                  <select required name="wholesalerId" defaultValue={editingProduct.wholesalerId} className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5">
                    {wholesalers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Quantity</label>
                  <input required type="number" min="0" name="quantity" defaultValue={editingProduct.quantity} className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Cost per unit (INR)</label>
                  <input required type="number" step="0.01" name="cost" defaultValue={editingProduct.cost} className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Purchase Date</label>
                  <input required type="date" name="purchaseDate" defaultValue={editingProduct.purchaseDate} className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" />
                </div>
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
                <p className="text-[9px] text-brand-muted uppercase tracking-wider mb-1">Wholesaler</p>
                <p className="text-xs font-medium">{p.wholesalerName}</p>
              </div>
              <div>
                <p className="text-[9px] text-brand-muted uppercase tracking-wider mb-1">Stock</p>
                <p className="text-xs font-semibold">{p.quantity} Units</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-brand-muted uppercase tracking-wider mb-1">Cost/Unit</p>
                <p className="text-lg font-mono font-bold text-brand-accent">{formatCurrency(p.cost)}</p>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-brand-surface">
              <button 
                onClick={() => setEditingProduct(p)}
                className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-ink bg-brand-surface rounded-xl hover:bg-brand-surface/80"
              >
                <Edit2 size={14} />
                Edit
              </button>
              <button 
                onClick={() => setHistoryProductId(p.id)}
                className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-accent bg-brand-accent/5 rounded-xl transition-colors hover:bg-brand-accent/10"
              >
                <HistoryIcon size={14} />
                History
              </button>
              <button 
                onClick={() => setIsAdjusting(p.id)}
                className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-ink bg-brand-surface rounded-xl hover:bg-brand-surface/80"
              >
                <Edit2 size={14} />
                Adjust
              </button>
              <button 
                onClick={() => handleDelete(p.id)}
                className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-red-600 bg-red-50 rounded-xl hover:bg-red-100"
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
                <th className="px-8 py-5 font-semibold text-center">In Stock</th>
                <th className="px-8 py-5 font-semibold text-right">Cost/Unit</th>
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
                  <td className="px-8 py-6 text-center text-sm font-bold">{p.quantity}</td>
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
                    <div className="flex justify-end gap-1">
                      <button 
                        onClick={() => setEditingProduct(p)}
                        className="p-2 text-brand-muted hover:text-brand-ink transition-colors mb-1"
                        title="Edit Product"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => setHistoryProductId(p.id)}
                        className="p-2 text-brand-muted hover:text-brand-accent transition-colors mb-1"
                        title="View History"
                      >
                        <HistoryIcon size={16} />
                      </button>
                      <button 
                        onClick={() => setIsAdjusting(p.id)}
                        className="p-2 text-brand-muted hover:text-brand-ink transition-colors mb-1"
                        title="Adjust Stock"
                      >
                        <Plus size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(p.id)} 
                        className="p-2 text-brand-muted hover:text-red-600 transition-colors"
                        title="Delete Product"
                      >
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

      {/* History Modal */}
      {historyProductId && historyProduct && (
        <div className="fixed inset-0 bg-brand-ink/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-10 border-b border-brand-border flex items-center justify-between">
              <div>
                <h3 className="font-serif italic text-3xl text-brand-ink">{historyProduct.name}</h3>
                <p className="text-[10px] uppercase font-bold tracking-widest text-brand-muted mt-2">Inventory Log & Activity</p>
              </div>
              <button 
                onClick={() => setHistoryProductId(null)} 
                className="w-12 h-12 flex items-center justify-center rounded-full bg-brand-surface hover:bg-brand-surface/80 transition-colors"
              >
                <Plus className="rotate-45" size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-10 space-y-6">
              {productHistory.length === 0 ? (
                <div className="py-20 text-center opacity-30 italic text-sm">No activity recorded for this item</div>
              ) : (
                <div className="space-y-4">
                  {productHistory.map((item) => (
                    <div key={item.id} className="flex items-start gap-4 p-5 bg-brand-bg rounded-2xl border border-brand-border/40">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        item.change > 0 ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-600"
                      )}>
                        {item.change > 0 ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-brand-ink">{item.note}</p>
                          <span className={cn(
                            "text-xs font-mono font-bold",
                            item.change > 0 ? "text-emerald-600" : "text-orange-600"
                          )}>
                            {item.change > 0 ? '+' : ''}{item.change}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-brand-muted opacity-60">{item.type}</span>
                          <span className="w-1 h-1 rounded-full bg-brand-border" />
                          <span className="text-[9px] font-bold uppercase tracking-widest text-brand-muted opacity-60">{item.date}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-8 border-t border-brand-border bg-brand-surface/20">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-accent/10 flex items-center justify-center text-brand-accent">
                      <Package size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold tracking-widest text-brand-muted">Current Stock</p>
                      <p className="text-xl font-serif italic text-brand-ink">{historyProduct.quantity} Units</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setHistoryProductId(null);
                      setIsAdjusting(historyProduct.id);
                    }}
                    className="px-6 py-3 bg-brand-ink text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-ink/90 transition-all"
                  >
                    Adjust Stock
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {isAdjusting && (
        <div className="fixed inset-0 bg-brand-ink/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-2xl font-bold italic font-serif">Adjust Stock</h3>
              <button onClick={() => setIsAdjusting(null)} className="opacity-40 hover:opacity-100 transition-opacity"><Plus className="rotate-45" /></button>
            </div>
            <form onSubmit={handleAdjustStock} className="space-y-6">
              <div>
                <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-3 block text-center">Adjustment Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="relative cursor-pointer">
                    <input type="radio" name="type" value="restock" defaultChecked className="peer sr-only" />
                    <div className="p-4 border-2 border-brand-bg rounded-2xl text-center peer-checked:border-brand-accent peer-checked:bg-brand-accent/5 transition-all">
                      <p className="text-[10px] font-bold uppercase tracking-widest">Restock (+)</p>
                    </div>
                  </label>
                  <label className="relative cursor-pointer">
                    <input type="radio" name="type" value="adjustment" className="peer sr-only" />
                    <div className="p-4 border-2 border-brand-bg rounded-2xl text-center peer-checked:border-brand-accent peer-checked:bg-brand-accent/5 transition-all">
                      <p className="text-[10px] font-bold uppercase tracking-widest">Correction (±)</p>
                    </div>
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Qty Change</label>
                  <input required type="number" name="quantityChange" className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5 focus:outline-brand-accent" placeholder="e.g. 5 or -2" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Date</label>
                  <input required type="date" name="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Notes / Reason</label>
                <input required name="note" className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5 focus:outline-brand-accent" placeholder="e.g. New stock from wholesaler" />
              </div>
              <button type="submit" className="w-full bg-brand-accent text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-brand-accent/20">Record Adjustment</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
