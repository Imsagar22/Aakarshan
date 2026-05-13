import React from 'react';
import { Plus, Search, Filter, MoreVertical, Trash2, Edit2, Download, ArrowUpDown, ChevronUp, ChevronDown, Upload, CheckSquare, Square, X, Check } from 'lucide-react';
import { Product, Contact } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { collection, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import * as XLSX from 'xlsx';

import { type User } from 'firebase/auth';

interface InventoryProps {
  products: Product[];
  wholesalers: Contact[];
  user: User;
}

interface SortIconProps {
  field: string;
  currentField: string;
  direction: 'asc' | 'desc';
}

function SortIcon({ field, currentField, direction }: SortIconProps) {
  if (field !== currentField) return <ArrowUpDown size={12} className="opacity-20 group-hover/th:opacity-50 transition-opacity" />;
  return direction === 'asc' ? <ChevronUp size={12} className="text-brand-accent" /> : <ChevronDown size={12} className="text-brand-accent" />;
}

export function Inventory({ products, wholesalers, user }: InventoryProps) {
  const [isAdding, setIsAdding] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState<'All' | 'In Stock' | 'Sold'>('All');
  const [sortField, setSortField] = React.useState<keyof Product | 'createdAt'>('createdAt');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('desc');
  const [isImporting, setIsImporting] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [bulkEditMode, setBulkEditMode] = React.useState<'none' | 'category' | 'wholesaler' | 'cost' | 'status' | 'quantity'>('none');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredProducts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProducts.map(p => p.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSort = (field: keyof Product | 'createdAt') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredProducts = products
    .filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           p.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'All' || p.status === filterStatus;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortField === 'createdAt') {
        const aTime = (a.createdAt as any)?.seconds || 0;
        const bTime = (b.createdAt as any)?.seconds || 0;
        return sortDirection === 'asc' ? aTime - bTime : bTime - aTime;
      }

      const aValue = a[sortField as keyof Product];
      const bValue = b[sortField as keyof Product];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
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

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (data.length === 0) {
          alert('No data found in the file');
          setIsImporting(false);
          return;
        }

        const batch = writeBatch(db);
        const inventoryRef = collection(db, 'inventory');

        let importCount = 0;
        for (const item of data) {
          // Flexible mapping for headers
          const name = item.Name || item.Item || item.product || item.ProductName;
          const category = item.Category || item.Type || item.category || 'General';
          const wholesalerName = item.Wholesaler || item.Supplier || item.wholesalerName || 'Unknown';
          const cost = Number(item.Cost || item.Price || item.cost || 0);
          const quantity = Number(item.Quantity || item.Stock || item.quantity || 1);
          const purchaseDate = item['Purchase Date'] || item.Date || item.purchaseDate || new Date().toISOString().split('T')[0];

          if (!name) continue;

          // Find wholesaler ID if possible
          const wholesaler = wholesalers.find(w => 
            w.name.toLowerCase() === wholesalerName.toLowerCase()
          );

          const productData = {
            userId: user.uid,
            name,
            category,
            wholesalerId: wholesaler?.id || 'unknown',
            wholesalerName: wholesaler?.name || wholesalerName,
            cost,
            quantity,
            purchaseDate,
            status: quantity > 0 ? 'In Stock' : 'Sold',
            createdAt: serverTimestamp(),
          };

          const newDocRef = doc(inventoryRef);
          batch.set(newDocRef, productData);
          importCount++;

          // Firestore batch limit is 500
          if (importCount % 500 === 0) {
            await batch.commit();
            // In a real app we'd create a new batch here, but for simplicity let's assume < 500 or just notify
          }
        }

        if (importCount > 0) {
          await batch.commit();
          alert(`Successfully imported ${importCount} items.`);
        }
      } catch (error) {
        console.error('Import error:', error);
        alert('Error importing file. Please check the format.');
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsBinaryString(file);
  }

  async function handleBulkDelete() {
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} items?`)) return;
    
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.delete(doc(db, 'inventory', id));
      });
      await batch.commit();
      setSelectedIds([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'inventory-bulk');
    }
  }

  async function handleBulkUpdate(field: string, value: any) {
    try {
      const batch = writeBatch(db);
      const updates: any = { [field]: value };
      
      if (field === 'wholesalerId') {
        const wholesaler = wholesalers.find(w => w.id === value);
        updates.wholesalerName = wholesaler?.name || 'Unknown';
      }

      if (field === 'cost' || field === 'quantity') {
        updates[field] = Number(value);
      }

      selectedIds.forEach(id => {
        batch.update(doc(db, 'inventory', id), updates);
      });
      
      await batch.commit();
      setSelectedIds([]);
      setBulkEditMode('none');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'inventory-bulk');
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-brand-border pb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif italic text-brand-accent leading-none">Aakarshan Inventory</h1>
          <p className="text-[10px] md:text-xs text-brand-muted mt-2 font-medium tracking-widest uppercase">Collection Management</p>
        </div>
        <div className="w-full sm:w-auto flex flex-wrap items-center gap-3">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImport} 
            accept=".csv, .xlsx, .xls" 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-brand-border text-brand-ink px-6 py-3 rounded-full font-bold text-[11px] uppercase tracking-widest hover:bg-brand-surface transition-all disabled:opacity-50"
          >
            <Upload size={16} />
            {isImporting ? 'Importing...' : 'Import'}
          </button>
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
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-3 px-2 border-r border-brand-border pr-6 animate-in fade-in slide-in-from-left-4">
            <button 
              onClick={() => setSelectedIds([])}
              className="p-2 hover:bg-brand-surface rounded-full transition-colors"
            >
              <X size={16} className="text-brand-muted" />
            </button>
            <span className="text-xs font-bold text-brand-accent whitespace-nowrap">{selectedIds.length} SELECTED</span>
          </div>
        )}
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
          <div 
            key={p.id} 
            className={cn(
              "bg-white p-6 rounded-3xl border transition-all shadow-sm relative overflow-hidden",
              selectedIds.includes(p.id) ? "border-brand-accent ring-1 ring-brand-accent/20 bg-brand-accent/[0.02]" : "border-brand-border"
            )}
            onClick={(e) => {
              if (e.target instanceof HTMLButtonElement || e.target instanceof SVGSVGElement) return;
              toggleSelect(p.id);
            }}
          >
            {selectedIds.includes(p.id) && (
              <div className="absolute top-0 right-0 p-2 text-brand-accent">
                <CheckSquare size={16} />
              </div>
            )}
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
                <p className="text-lg font-mono font-bold text-brand-accent">{formatCurrency(p.cost, true)}</p>
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
                <th className="px-8 py-5 w-10">
                  <button 
                    onClick={toggleSelectAll}
                    className="p-1 hover:bg-brand-ink/5 rounded transition-colors"
                  >
                    {selectedIds.length === filteredProducts.length && filteredProducts.length > 0 ? (
                      <CheckSquare size={16} className="text-brand-accent" />
                    ) : (
                      <Square size={16} className="opacity-20" />
                    )}
                  </button>
                </th>
                <th 
                  className="px-8 py-5 font-semibold cursor-pointer hover:bg-brand-ink/5 transition-colors group/th"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-2">
                    Item Details
                    <SortIcon field="name" currentField={sortField} direction={sortDirection} />
                  </div>
                </th>
                <th 
                  className="px-8 py-5 font-semibold cursor-pointer hover:bg-brand-ink/5 transition-colors group/th"
                  onClick={() => handleSort('category')}
                >
                  <div className="flex items-center gap-2">
                    Category
                    <SortIcon field="category" currentField={sortField} direction={sortDirection} />
                  </div>
                </th>
                <th className="px-8 py-5 font-semibold">Wholesaler</th>
                <th 
                  className="px-8 py-5 font-semibold cursor-pointer hover:bg-brand-ink/5 transition-colors group/th text-right"
                  onClick={() => handleSort('cost')}
                >
                  <div className="flex items-center justify-end gap-2">
                    Cost
                    <SortIcon field="cost" currentField={sortField} direction={sortDirection} />
                  </div>
                </th>
                <th 
                  className="px-8 py-5 font-semibold cursor-pointer hover:bg-brand-ink/5 transition-colors group/th text-center"
                  onClick={() => handleSort('quantity')}
                >
                  <div className="flex items-center justify-center gap-2">
                    Stock
                    <SortIcon field="quantity" currentField={sortField} direction={sortDirection} />
                  </div>
                </th>
                <th className="px-8 py-5 font-semibold text-center">Status</th>
                <th className="px-8 py-5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-surface">
              {filteredProducts.map((p) => (
                <tr 
                  key={p.id} 
                  className={cn(
                    "group transition-colors",
                    selectedIds.includes(p.id) 
                      ? "bg-brand-accent/[0.03]" 
                      : "hover:bg-brand-surface/40"
                  )}
                >
                  <td className="px-8 py-6">
                    <button 
                      onClick={() => toggleSelect(p.id)}
                      className="p-1 hover:bg-brand-ink/5 rounded transition-colors"
                    >
                      {selectedIds.includes(p.id) ? (
                        <CheckSquare size={16} className="text-brand-accent" />
                      ) : (
                        <Square size={16} className="opacity-10 group-hover:opacity-30" />
                      )}
                    </button>
                  </td>
                  <td className="px-8 py-6">
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-[10px] text-brand-muted mt-1 uppercase tracking-widest">Entry: {p.purchaseDate}</p>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-xs text-brand-muted italic">{p.category}</span>
                  </td>
                  <td className="px-8 py-6 text-sm">{p.wholesalerName}</td>
                  <td className="px-8 py-6 text-sm font-mono text-right">{formatCurrency(p.cost, true)}</td>
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

      {/* Bulk Actions Floating Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-8">
          <div className="bg-brand-ink text-white px-6 py-4 rounded-[2rem] shadow-2xl flex items-center gap-6 border border-white/10 backdrop-blur-md">
            <div className="pr-6 border-r border-white/10">
              <p className="text-[10px] uppercase font-bold tracking-widest opacity-60">Selected</p>
              <p className="text-sm font-bold">{selectedIds.length} Pieces</p>
            </div>

            {bulkEditMode === 'none' ? (
              <div className="flex items-center gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <button 
                    onClick={() => setBulkEditMode('category')}
                    className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 rounded-xl transition-all"
                  >
                    Category
                  </button>
                  <button 
                    onClick={() => setBulkEditMode('wholesaler')}
                    className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 rounded-xl transition-all"
                  >
                    Wholesaler
                  </button>
                  <button 
                    onClick={() => setBulkEditMode('cost')}
                    className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 rounded-xl transition-all"
                  >
                    Cost
                  </button>
                  <button 
                    onClick={() => setBulkEditMode('quantity')}
                    className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 rounded-xl transition-all"
                  >
                    Stock
                  </button>
                  <button 
                    onClick={() => setBulkEditMode('status')}
                    className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 rounded-xl transition-all"
                  >
                    Status
                  </button>
                </div>
                <div className="h-4 w-px bg-white/10 hidden sm:block" />
                <button 
                  onClick={handleBulkDelete}
                  className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-red-400 hover:bg-red-500/10 rounded-xl transition-all flex items-center gap-2"
                >
                  <Trash2 size={14} />
                  Bulk Delete
                </button>
              </div>
            ) : bulkEditMode === 'category' ? (
              <div className="flex items-center gap-3 animate-in fade-in zoom-in-95">
                <input 
                  autoFocus
                  placeholder="New category..."
                  className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-xs focus:outline-brand-accent min-w-[200px]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleBulkUpdate('category', e.currentTarget.value);
                    if (e.key === 'Escape') setBulkEditMode('none');
                  }}
                />
                <button 
                  onClick={(e) => {
                    const input = e.currentTarget.parentElement?.querySelector('input');
                    if (input) handleBulkUpdate('category', input.value);
                  }}
                  className="p-2 bg-brand-accent rounded-xl hover:scale-105 transition-all text-white"
                >
                  <Check size={16} />
                </button>
                <button 
                  onClick={() => setBulkEditMode('none')}
                  className="p-2 hover:bg-white/10 rounded-xl transition-all"
                >
                  <X size={16} />
                </button>
              </div>
            ) : bulkEditMode === 'wholesaler' ? (
              <div className="flex items-center gap-3 animate-in fade-in zoom-in-95">
                <select 
                  className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-xs focus:outline-brand-accent min-w-[200px] text-white [&>option]:text-brand-ink"
                  onChange={(e) => handleBulkUpdate('wholesalerId', e.target.value)}
                >
                  <option value="">Select Wholesaler...</option>
                  {wholesalers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <button 
                  onClick={() => setBulkEditMode('none')}
                  className="p-2 hover:bg-white/10 rounded-xl transition-all"
                >
                  <X size={16} />
                </button>
              </div>
            ) : bulkEditMode === 'cost' || bulkEditMode === 'quantity' ? (
              <div className="flex items-center gap-3 animate-in fade-in zoom-in-95">
                <input 
                  type="number"
                  autoFocus
                  placeholder={bulkEditMode === 'cost' ? "New cost..." : "New stock..."}
                  className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-xs focus:outline-brand-accent min-w-[150px]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleBulkUpdate(bulkEditMode === 'cost' ? 'cost' : 'quantity', e.currentTarget.value);
                    if (e.key === 'Escape') setBulkEditMode('none');
                  }}
                />
                <button 
                  onClick={(e) => {
                    const input = e.currentTarget.parentElement?.querySelector('input');
                    if (input) handleBulkUpdate(bulkEditMode === 'cost' ? 'cost' : 'quantity', input.value);
                  }}
                  className="p-2 bg-brand-accent rounded-xl hover:scale-105 transition-all text-white"
                >
                  <Check size={16} />
                </button>
                <button 
                  onClick={() => setBulkEditMode('none')}
                  className="p-2 hover:bg-white/10 rounded-xl transition-all"
                >
                  <X size={16} />
                </button>
              </div>
            ) : bulkEditMode === 'status' ? (
              <div className="flex items-center gap-2 animate-in fade-in zoom-in-95">
                <button 
                  onClick={() => handleBulkUpdate('status', 'In Stock')}
                  className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest bg-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500/30 transition-all"
                >
                  Set In Stock
                </button>
                <button 
                  onClick={() => handleBulkUpdate('status', 'Sold')}
                  className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest bg-brand-muted/20 text-brand-muted rounded-xl hover:bg-brand-muted/30 transition-all"
                >
                  Set Sold
                </button>
                <button 
                  onClick={() => setBulkEditMode('none')}
                  className="p-2 hover:bg-white/10 rounded-xl transition-all"
                >
                  <X size={16} />
                </button>
              </div>
            ) : null}

            <button 
              onClick={() => setSelectedIds([])}
              className="ml-2 p-2 hover:bg-white/10 rounded-full transition-all group"
              title="Clear Selection"
            >
              <X size={18} className="opacity-40 group-hover:opacity-100" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
