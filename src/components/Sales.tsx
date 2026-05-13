import React from 'react';
import { ShoppingBag, ArrowRight, Calendar, User as UserIcon, IndianRupee, Search, Trash2, Edit2, BarChart3 } from 'lucide-react';
import { Product, Contact, Sale } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { collection, addDoc, serverTimestamp, updateDoc, doc, runTransaction, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
} from 'recharts';

import { type User } from 'firebase/auth';

interface SalesProps {
  sales: Sale[];
  products: Product[];
  customers: Contact[];
  user: User;
}

export function Sales({ sales, products, customers, user }: SalesProps) {
  const [isRecording, setIsRecording] = React.useState(false);
  const [selectedProductId, setSelectedProductId] = React.useState<string>('');
  const [editingSale, setEditingSale] = React.useState<Sale | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');

  const inStockProducts = products.filter(p => p.status === 'In Stock');
  const selectedProduct = products.find(p => p.id === selectedProductId);

  async function handleRecordSale(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const productId = formData.get('productId') as string;
    const customerId = formData.get('customerId') as string;
    const product = products.find(p => p.id === productId);
    const customer = customers.find(c => c.id === customerId);

    if (!product || !customer) return;

    console.log('Attempting to record sale transaction:', { productId, customerId });
    const saleQuantity = Number(formData.get('quantity'));
    const unitRetailPrice = Number(formData.get('retailPrice'));
    const unitCostPrice = Number(formData.get('costAtSale'));
    const paymentStatus = formData.get('paymentStatus') as 'Paid' | 'Credit';

    try {
      // Use transaction to ensure both documents are updated atomically
      await runTransaction(db, async (transaction) => {
        const productRef = doc(db, 'inventory', productId);
        const saleRef = doc(collection(db, 'sales'));

        const currentQuantity = product.quantity || 0;
        const newQuantity = currentQuantity - saleQuantity;
        
        if (newQuantity < 0) {
          throw new Error('Not enough items in stock');
        }

        transaction.update(productRef, { 
          quantity: newQuantity,
          status: newQuantity > 0 ? 'In Stock' : 'Sold' 
        });
        
        transaction.set(saleRef, {
          userId: user.uid,
          productId,
          productName: product.name,
          customerId,
          customerName: customer.name,
          quantity: saleQuantity,
          retailPrice: unitRetailPrice,
          costAtSale: unitCostPrice,
          saleDate: formData.get('saleDate') as string,
          paymentStatus,
          createdAt: serverTimestamp(),
        });
      });
      console.log('Sale transaction completed successfully');
      setIsRecording(false);
    } catch (error) {
      console.error('Error recording sale:', error);
      handleFirestoreError(error, OperationType.WRITE, 'sales');
    }
  }

  async function handleDeleteSale(sale: Sale) {
    if (!confirm('Are you sure you want to delete this sale record? This will return the item to inventory.')) return;

    try {
      await runTransaction(db, async (transaction) => {
        const productRef = doc(db, 'inventory', sale.productId);
        const saleRef = doc(db, 'sales', sale.id);

        const productSnap = await transaction.get(productRef);
        if (productSnap.exists()) {
          const currentQty = productSnap.data().quantity || 0;
          transaction.update(productRef, { 
            quantity: currentQty + (sale.quantity || 1),
            status: 'In Stock' 
          });
        }
        
        transaction.delete(saleRef);
      });
      console.log('Sale deleted successfully');
    } catch (error) {
      console.error('Error deleting sale:', error);
      handleFirestoreError(error, OperationType.DELETE, `sales/${sale.id}`);
    }
  }

  async function handleEditSale(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingSale) return;

    const formData = new FormData(e.currentTarget);
    const customerId = formData.get('customerId') as string;
    const customer = customers.find(c => c.id === customerId);

    if (!customer) return;

    const unitRetailPrice = Number(formData.get('retailPrice'));
    const unitCostPrice = Number(formData.get('costAtSale'));
    const newSaleQuantity = Number(formData.get('quantity'));
    const paymentStatus = formData.get('paymentStatus') as 'Paid' | 'Credit';

    try {
      await runTransaction(db, async (transaction) => {
        const saleRef = doc(db, 'sales', editingSale.id);
        const productRef = doc(db, 'inventory', editingSale.productId);
        
        const productSnap = await transaction.get(productRef);
        if (productSnap.exists()) {
          const currentStock = productSnap.data().quantity || 0;
          const oldSaleQuantity = editingSale.quantity || 1;
          const diff = newSaleQuantity - oldSaleQuantity;
          const updatedStock = currentStock - diff;

          if (updatedStock < 0) {
            throw new Error('Not enough items in stock to update quantity');
          }

          transaction.update(productRef, {
            quantity: updatedStock,
            status: updatedStock > 0 ? 'In Stock' : 'Sold'
          });
        }

        transaction.update(saleRef, {
          customerId,
          customerName: customer.name,
          quantity: newSaleQuantity,
          retailPrice: unitRetailPrice,
          costAtSale: unitCostPrice,
          saleDate: formData.get('saleDate') as string,
          paymentStatus,
        });
      });
      setEditingSale(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sales/${editingSale.id}`);
    }
  }

  const filteredSales = sales
    .filter(s => 
      s.productName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.customerName.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => b.saleDate.localeCompare(a.saleDate));

  const chartData = React.useMemo(() => {
    const dailySales: { [key: string]: number } = {};
    sales.forEach(s => {
      const date = s.saleDate;
      dailySales[date] = (dailySales[date] || 0) + (s.retailPrice * (s.quantity || 1));
    });

    return Object.entries(dailySales)
      .map(([date, total]) => ({
        date: new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        rawDate: date,
        total
      }))
      .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
      .slice(-7); // Last 7 active sales days
  }, [sales]);

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

      {/* Sales Performance Chart */}
      {chartData.length > 0 && (
        <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-brand-border shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2.5 bg-brand-accent/5 rounded-xl text-brand-accent">
              <BarChart3 size={20} />
            </div>
            <div>
              <h3 className="font-serif italic text-xl font-medium leading-none">Sales Performance</h3>
              <p className="text-[10px] text-brand-muted uppercase tracking-widest mt-1.5 font-bold">Revenue over last 7 active days</p>
            </div>
          </div>
          
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#00000008" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }}
                />
                <Tooltip 
                  cursor={{ fill: '#00000005' }}
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: '1px solid #f1f5f9', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontSize: '11px',
                    fontWeight: 600
                  }}
                  formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                />
                <Bar 
                  dataKey="total" 
                  fill="#7c3aed" 
                  radius={[6, 6, 0, 0]} 
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

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
                <select 
                  required 
                  name="productId" 
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5"
                >
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
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Unit Price (INR)</label>
                  <input required type="number" step="0.01" name="retailPrice" className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" placeholder="0.00" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Unit Cost (INR)</label>
                  <input required type="number" step="0.01" name="costAtSale" defaultValue={selectedProduct?.cost || 0} className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" placeholder="0.00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Quantity</label>
                  <input required type="number" min="1" name="quantity" defaultValue="1" className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Sale Date</label>
                  <input required type="date" name="saleDate" defaultValue={new Date().toISOString().split('T')[0]} className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Payment Status</label>
                <div className="flex gap-4">
                  <label className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border border-brand-ink/5 bg-brand-bg cursor-pointer has-[:checked]:border-brand-accent has-[:checked]:bg-brand-accent/5 transition-all">
                    <input required type="radio" name="paymentStatus" value="Paid" defaultChecked className="hidden" />
                    <span className="text-xs font-bold uppercase tracking-widest">Paid</span>
                  </label>
                  <label className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border border-brand-ink/5 bg-brand-bg cursor-pointer has-[:checked]:border-brand-accent has-[:checked]:bg-brand-accent/5 transition-all">
                    <input required type="radio" name="paymentStatus" value="Credit" className="hidden" />
                    <span className="text-xs font-bold uppercase tracking-widest text-amber-600">Credit</span>
                  </label>
                </div>
              </div>
              <button type="submit" className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-xs mt-4">Confirm Sale</button>
            </form>
          </div>
        </div>
      )}

      {editingSale && (
        <div className="fixed inset-0 bg-brand-ink/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-2xl font-bold">Edit Transaction</h3>
              <button onClick={() => setEditingSale(null)} className="opacity-40 hover:opacity-100 transition-opacity"><ArrowRight className="rotate-45" /></button>
            </div>
            <form onSubmit={handleEditSale} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Product</label>
                <div className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5 opacity-50">
                  {editingSale.productName}
                </div>
                <p className="text-[9px] mt-1 text-brand-muted italic">Product cannot be changed. Delete and re-record if needed.</p>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Customer</label>
                <select required name="customerId" defaultValue={editingSale.customerId} className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5">
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Unit Price (INR)</label>
                  <input required type="number" step="0.01" name="retailPrice" defaultValue={editingSale.retailPrice} className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" placeholder="0.00" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Unit Cost (INR)</label>
                  <input required type="number" step="0.01" name="costAtSale" defaultValue={editingSale.costAtSale} className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" placeholder="0.00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Quantity</label>
                  <input required type="number" min="1" name="quantity" defaultValue={editingSale.quantity || 1} className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Sale Date</label>
                  <input required type="date" name="saleDate" defaultValue={editingSale.saleDate} className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Payment Status</label>
                <div className="flex gap-4">
                  <label className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border border-brand-ink/5 bg-brand-bg cursor-pointer has-[:checked]:border-brand-accent has-[:checked]:bg-brand-accent/5 transition-all">
                    <input required type="radio" name="paymentStatus" value="Paid" defaultChecked={editingSale.paymentStatus === 'Paid'} className="hidden" />
                    <span className="text-xs font-bold uppercase tracking-widest">Paid</span>
                  </label>
                  <label className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border border-brand-ink/5 bg-brand-bg cursor-pointer has-[:checked]:border-brand-accent has-[:checked]:bg-brand-accent/5 transition-all">
                    <input required type="radio" name="paymentStatus" value="Credit" defaultChecked={editingSale.paymentStatus === 'Credit'} className="hidden" />
                    <span className="text-xs font-bold uppercase tracking-widest text-amber-600">Credit</span>
                  </label>
                </div>
              </div>
              <button type="submit" className="w-full bg-brand-accent text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-xs mt-4">Update Sale</button>
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
                  <h4 className="font-serif italic text-lg sm:text-xl font-medium">
                    {sale.productName} 
                    <span className="ml-2 text-xs font-sans not-italic text-brand-muted uppercase tracking-widest">({sale.quantity || 1} units)</span>
                  </h4>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                      <UserIcon size={12} /> {sale.customerName}
                    </span>
                    <span className="hidden sm:block w-1 h-1 rounded-full bg-brand-border" />
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                      <Calendar size={12} /> {sale.saleDate}
                    </span>
                    <span className="hidden sm:block w-1 h-1 rounded-full bg-brand-border" />
                    <span className={cn(
                      "inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest",
                      sale.paymentStatus === 'Paid' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                    )}>
                      {sale.paymentStatus}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 lg:flex lg:items-center gap-8 lg:gap-12 text-left lg:text-right border-t lg:border-t-0 pt-6 lg:pt-0 border-brand-border/30">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-muted mb-2">Total Sale</p>
                  <p className="text-xl sm:text-2xl font-light text-brand-ink">{formatCurrency(sale.retailPrice * (sale.quantity || 1))}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-muted mb-2">Total Cost</p>
                  <p className="text-xl sm:text-2xl font-light text-brand-muted">{formatCurrency(sale.costAtSale * (sale.quantity || 1))}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent mb-2">Net Profit</p>
                  <p className="text-xl sm:text-2xl font-semibold text-brand-accent">{formatCurrency((sale.retailPrice - sale.costAtSale) * (sale.quantity || 1))}</p>
                </div>
                <div className="col-span-2 lg:col-auto flex lg:flex-col justify-end gap-2 pt-4 lg:pt-0 border-t lg:border-t-0 border-brand-border/30">
                  <button 
                    onClick={() => setEditingSale(sale)}
                    className="p-3 text-brand-muted hover:text-brand-accent transition-colors bg-white lg:bg-transparent rounded-xl"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    onClick={() => handleDeleteSale(sale)}
                    className="p-3 text-brand-muted hover:text-red-600 transition-colors bg-white lg:bg-transparent rounded-xl"
                  >
                    <Trash2 size={18} />
                  </button>
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
