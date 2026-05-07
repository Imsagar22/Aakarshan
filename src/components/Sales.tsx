import React from 'react';
import { ShoppingBag, ArrowRight, Calendar, User as UserIcon, IndianRupee, Search, CreditCard, Banknote, CheckCircle2, Edit2, Trash2, X, Undo2 } from 'lucide-react';
import { Product, Contact, Sale } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { collection, addDoc, serverTimestamp, updateDoc, doc, runTransaction, getDoc, deleteDoc } from 'firebase/firestore';
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
  const [editingSale, setEditingSale] = React.useState<Sale | null>(null);
  const [returningSale, setReturningSale] = React.useState<Sale | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterPayment, setFilterPayment] = React.useState<'All' | 'Cash' | 'Credit'>('All');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');

  const inStockProducts = products.filter(p => p.status === 'In Stock');

  async function handleUpdatePayment(sale: Sale) {
    try {
      await runTransaction(db, async (transaction) => {
        const saleRef = doc(db, 'sales', sale.id);
        const productRef = doc(db, 'inventory', sale.productId);

        const productDoc = await transaction.get(productRef);
        if (!productDoc.exists()) throw new Error("Product no longer exists in inventory!");

        const currentQuantity = productDoc.data().quantity || 0;
        const soldQuantity = sale.quantity || 1;

        if (currentQuantity < soldQuantity) {
          throw new Error(`Insufficient stock for ${sale.productName}. Required: ${soldQuantity}, Available: ${currentQuantity}`);
        }

        const newQuantity = currentQuantity - soldQuantity;

        // Update Sale Status
        transaction.update(saleRef, {
          paymentStatus: 'Cash'
        });

        // Update Inventory
        transaction.update(productRef, {
          quantity: newQuantity,
          status: newQuantity === 0 ? 'Sold' : 'In Stock'
        });
      });
      console.log('Credit sale marked as paid and inventory updated');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sales/${sale.id}`);
    }
  }

  async function handleRecordSale(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const productId = formData.get('productId') as string;
    const customerId = formData.get('customerId') as string;
    const soldQuantity = Number(formData.get('quantity'));
    const paymentStatus = formData.get('paymentStatus') as 'Cash' | 'Credit';
    const dueDate = formData.get('dueDate') as string;
    const product = products.find(p => p.id === productId);
    const customer = customers.find(c => c.id === customerId);

    if (!product || !customer) return;

    try {
      if (paymentStatus === 'Cash') {
        // Cash Sale: Decrement inventory immediately
        await runTransaction(db, async (transaction) => {
          const productRef = doc(db, 'inventory', productId);
          const saleRef = doc(collection(db, 'sales'));

          const productDoc = await transaction.get(productRef);
          if (!productDoc.exists()) throw new Error("Product does not exist!");
          
          const currentQuantity = productDoc.data().quantity || 0;
          if (currentQuantity < soldQuantity) throw new Error("Not enough stock!");

          const newQuantity = currentQuantity - soldQuantity;
          
          transaction.update(productRef, { 
            quantity: newQuantity,
            status: newQuantity === 0 ? 'Sold' : 'In Stock'
          });

          transaction.set(saleRef, {
            userId: user.uid,
            productId,
            productName: product.name,
            customerId,
            customerName: customer.name,
            retailPrice: Number(formData.get('retailPrice')),
            costAtSale: product.cost,
            quantity: soldQuantity,
            paymentStatus,
            saleDate: formData.get('saleDate') as string,
            createdAt: serverTimestamp(),
          });
        });
      } else {
        // Credit Sale: Record sale but DON'T decrement inventory yet
        await addDoc(collection(db, 'sales'), {
          userId: user.uid,
          productId,
          productName: product.name,
          customerId,
          customerName: customer.name,
          retailPrice: Number(formData.get('retailPrice')),
          costAtSale: product.cost,
          quantity: soldQuantity,
          paymentStatus: 'Credit',
          dueDate: dueDate || null,
          saleDate: formData.get('saleDate') as string,
          createdAt: serverTimestamp(),
        });
      }
      
      console.log('Sale record created successfully');
      setIsRecording(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sales');
    }
  }

  async function handleUpdateSale(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingSale) return;

    const formData = new FormData(e.currentTarget);
    const retailPrice = Number(formData.get('retailPrice'));
    const quantity = Number(formData.get('quantity'));
    const saleDate = formData.get('saleDate') as string;
    const dueDate = formData.get('dueDate') as string;
    const customerId = formData.get('customerId') as string;
    const customer = customers.find(c => c.id === customerId);

    try {
      await runTransaction(db, async (transaction) => {
        const saleRef = doc(db, 'sales', editingSale.id);
        const productRef = doc(db, 'inventory', editingSale.productId);

        const currentSaleDoc = await transaction.get(saleRef);
        if (!currentSaleDoc.exists()) throw new Error("Sale records not found");
        
        const oldQty = currentSaleDoc.data().quantity || 1;
        const qtyDiff = quantity - oldQty;

        // If it was a Cash sale, we need to adjust inventory based on the quantity change
        if (editingSale.paymentStatus === 'Cash') {
          const productDoc = await transaction.get(productRef);
          if (productDoc.exists()) {
            const currentStock = productDoc.data().quantity || 0;
            const newStock = Math.max(0, currentStock - qtyDiff);
            transaction.update(productRef, {
              quantity: newStock,
              status: newStock > 0 ? 'In Stock' : 'Sold'
            });
          }
        }

        transaction.update(saleRef, {
          retailPrice,
          quantity,
          saleDate,
          dueDate: dueDate || null,
          customerId,
          customerName: customer?.name || 'Unknown'
        });
      });
      setEditingSale(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sales/${editingSale.id}`);
    }
  }

  async function handleDeleteSale(sale: Sale) {
    if (!confirm('Are you sure you want to delete this sale record? Inventory will be adjusted back.')) return;

    try {
      await runTransaction(db, async (transaction) => {
        const saleRef = doc(db, 'sales', sale.id);
        const productRef = doc(db, 'inventory', sale.productId);

        // Adjust back inventory if it was a cash sale
        if (sale.paymentStatus === 'Cash') {
          const productDoc = await transaction.get(productRef);
          if (productDoc.exists()) {
            const currentStock = productDoc.data().quantity || 0;
            const restoredStock = currentStock + (sale.quantity || 1);
            transaction.update(productRef, {
              quantity: restoredStock,
              status: 'In Stock'
            });
          }
        }

        transaction.delete(saleRef);
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `sales/${sale.id}`);
    }
  }

  async function handleReturnSale(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!returningSale) return;

    const formData = new FormData(e.currentTarget);
    const returnQty = Number(formData.get('returnQuantity'));
    const note = formData.get('note') as string;

    try {
      await runTransaction(db, async (transaction) => {
        const saleRef = doc(db, 'sales', returningSale.id);
        const productRef = doc(db, 'inventory', returningSale.productId);

        const currentSaleDoc = await transaction.get(saleRef);
        if (!currentSaleDoc.exists()) throw new Error("Sale record not found");
        
        const saleData = currentSaleDoc.data() as Sale;
        const previouslyReturned = saleData.returnedQuantity || 0;
        const totalSold = saleData.quantity || 1;
        
        if (previouslyReturned + returnQty > totalSold) {
          throw new Error("Cannot return more than sold quantity");
        }

        const newReturnedQty = previouslyReturned + returnQty;
        const status = newReturnedQty === totalSold ? 'Returned' : 'Partially Returned';

        // Update Sale
        transaction.update(saleRef, {
          returnStatus: status,
          returnedQuantity: newReturnedQty
        });

        // Update Inventory if it was a Cash sale (meaning stock was actually decremented)
        if (saleData.paymentStatus === 'Cash') {
          const productDoc = await transaction.get(productRef);
          if (productDoc.exists()) {
            const currentStock = productDoc.data().quantity || 0;
            const newStock = currentStock + returnQty;
            transaction.update(productRef, {
              quantity: newStock,
              status: 'In Stock'
            });
          }
        }

        // Add Inventory Log
        const logRef = doc(collection(db, 'inventory_logs'));
        transaction.set(logRef, {
          userId: user.uid,
          productId: returningSale.productId,
          type: 'adjustment',
          quantityChange: returnQty,
          note: `Customer Return (${saleData.customerName}): ${note}`,
          date: new Date().toISOString().split('T')[0],
          createdAt: serverTimestamp(),
        });
      });
      setReturningSale(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sales/${returningSale.id}`);
    }
  }

  const filteredSales = sales
    .filter(s => {
      const matchesSearch = s.productName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           s.customerName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPayment = filterPayment === 'All' || s.paymentStatus === filterPayment;
      
      const saleDate = s.saleDate;
      const matchesStartDate = !startDate || saleDate >= startDate;
      const matchesEndDate = !endDate || saleDate <= endDate;

      return matchesSearch && matchesPayment && matchesStartDate && matchesEndDate;
    })
    .sort((a, b) => b.saleDate.localeCompare(a.saleDate));

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
              <button onClick={() => setIsRecording(false)} className="opacity-40 hover:opacity-100 transition-opacity"><X size={24} /></button>
            </div>
            <form onSubmit={handleRecordSale} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Select Product</label>
                <select required name="productId" className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5">
                  <option value="">Choose an item...</option>
                  {inStockProducts.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} - {p.quantity} left ({formatCurrency(p.cost)} cost)
                    </option>
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
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Quantity Sold</label>
                  <input required type="number" min="1" name="quantity" defaultValue="1" className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Total Price (INR)</label>
                  <input required type="number" step="0.01" name="retailPrice" className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" placeholder="0.00" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Sale Date</label>
                  <input required type="date" name="saleDate" defaultValue={new Date().toISOString().split('T')[0]} className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Due Date (Credit only)</label>
                  <input type="date" name="dueDate" className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Payment Type</label>
                <div className="grid grid-cols-2 gap-4">
                  <label className="relative flex items-center gap-3 p-4 bg-brand-bg rounded-xl border border-brand-ink/5 cursor-pointer hover:bg-brand-bg/80 transition-colors">
                    <input type="radio" name="paymentStatus" value="Cash" defaultChecked className="text-brand-accent focus:ring-brand-accent/20" />
                    <div className="flex items-center gap-2">
                      <Banknote size={16} className="text-emerald-600" />
                      <span className="text-[11px] font-bold uppercase tracking-widest">Cash Sale</span>
                    </div>
                  </label>
                  <label className="relative flex items-center gap-3 p-4 bg-brand-bg rounded-xl border border-brand-ink/5 cursor-pointer hover:bg-brand-bg/80 transition-colors">
                    <input type="radio" name="paymentStatus" value="Credit" className="text-brand-accent focus:ring-brand-accent/20" />
                    <div className="flex items-center gap-2">
                      <CreditCard size={16} className="text-brand-accent" />
                      <span className="text-[11px] font-bold uppercase tracking-widest">Credit Sale</span>
                    </div>
                  </label>
                </div>
              </div>
              <button type="submit" className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-xs mt-4">Confirm Sale</button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Sale Modal */}
      {editingSale && (
        <div className="fixed inset-0 bg-brand-ink/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-2xl font-bold">Edit Transaction</h3>
              <button onClick={() => setEditingSale(null)} className="opacity-40 hover:opacity-100 transition-opacity"><X size={24} /></button>
            </div>
            <form onSubmit={handleUpdateSale} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Product</label>
                <input disabled value={editingSale.productName} className="w-full bg-brand-bg/50 px-4 py-3 rounded-xl border border-brand-ink/5 opacity-60" />
                <p className="text-[8px] text-brand-muted mt-1 uppercase tracking-widest">Product cannot be changed. Delete and re-record if needed.</p>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Customer</label>
                <select required name="customerId" defaultValue={editingSale.customerId} className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5">
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Quantity Sold</label>
                  <input required type="number" min="1" name="quantity" defaultValue={editingSale.quantity || 1} className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Total Price (INR)</label>
                  <input required type="number" step="0.01" name="retailPrice" defaultValue={editingSale.retailPrice} className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Sale Date</label>
                  <input required type="date" name="saleDate" defaultValue={editingSale.saleDate} className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Due Date (Credit)</label>
                  <input type="date" name="dueDate" defaultValue={editingSale.dueDate || ''} className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" />
                </div>
              </div>
              <button type="submit" className="w-full bg-brand-accent text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-xs mt-4 shadow-lg shadow-brand-accent/20">Update Record</button>
            </form>
          </div>
        </div>
      )}

      {/* Return Sale Modal */}
      {returningSale && (
        <div className="fixed inset-0 bg-brand-ink/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-2xl font-bold italic font-serif">Return Sale</h3>
              <button onClick={() => setReturningSale(null)} className="opacity-40 hover:opacity-100 transition-opacity"><X size={24} /></button>
            </div>
            <div className="mb-6 p-4 bg-brand-bg rounded-2xl border border-brand-border/40">
              <p className="text-[10px] uppercase font-bold tracking-widest text-brand-muted mb-1">Product</p>
              <p className="text-sm font-bold text-brand-ink">{returningSale.productName}</p>
              <div className="flex justify-between mt-3 text-[10px] uppercase font-bold tracking-widest text-brand-muted">
                <span>Sold: {returningSale.quantity}</span>
                <span>Returned: {returningSale.returnedQuantity || 0}</span>
              </div>
            </div>
            <form onSubmit={handleReturnSale} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Quantity to Return</label>
                <input 
                  required 
                  type="number" 
                  min="1" 
                  max={(returningSale.quantity || 1) - (returningSale.returnedQuantity || 0)} 
                  name="returnQuantity" 
                  defaultValue={(returningSale.quantity || 1) - (returningSale.returnedQuantity || 0)} 
                  className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" 
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Reason / Note</label>
                <input required name="note" className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" placeholder="Reason for return..." />
              </div>
              <button type="submit" className="w-full bg-brand-accent text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-xs mt-4 shadow-lg shadow-brand-accent/20">Record Return</button>
            </form>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-6 rounded-3xl border border-brand-ink/5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-20" size={18} />
            <input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-brand-bg/50 rounded-xl text-sm border-none focus:ring-1 ring-brand-accent/20" 
              placeholder="Search by product or customer..." 
            />
          </div>
          <div className="flex bg-brand-bg p-1 rounded-xl shrink-0">
            {(['All', 'Cash', 'Credit'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterPayment(type)}
                className={cn(
                  "px-6 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                  filterPayment === type ? "bg-white text-brand-ink shadow-sm" : "text-brand-muted hover:text-brand-ink"
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 border-t border-brand-bg">
          <div className="flex items-center gap-3 flex-1 w-full">
            <div className="flex-1">
              <label className="text-[9px] uppercase font-bold tracking-widest opacity-40 mb-1 block px-1">From</label>
              <input 
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-brand-bg/50 px-4 py-2 rounded-xl text-xs border-none focus:ring-1 ring-brand-accent/20" 
              />
            </div>
            <div className="flex-1">
              <label className="text-[9px] uppercase font-bold tracking-widest opacity-40 mb-1 block px-1">To</label>
              <input 
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-brand-bg/50 px-4 py-2 rounded-xl text-xs border-none focus:ring-1 ring-brand-accent/20" 
              />
            </div>
            {(startDate || endDate) && (
              <button 
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="mt-5 text-[9px] font-bold uppercase tracking-widest text-brand-accent hover:underline px-2"
              >
                Clear
              </button>
            )}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 whitespace-nowrap">
            Showing {filteredSales.length} Transactions
          </div>
        </div>
      </div>

      {/* List */}
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
                      <UserIcon size={12} /> {sale.customerName}
                    </span>
                    <span className="hidden sm:block w-1 h-1 rounded-full bg-brand-border" />
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                      <Calendar size={12} /> {sale.saleDate}
                    </span>
                    <span className="hidden sm:block w-1 h-1 rounded-full bg-brand-border" />
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                      Qty: {sale.quantity || 1}
                    </span>
                    <span className="hidden sm:block w-1 h-1 rounded-full bg-brand-border" />
                    {sale.dueDate && sale.paymentStatus === 'Credit' && (
                      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-orange-600">
                        Due: {sale.dueDate}
                      </span>
                    )}
                    {sale.dueDate && sale.paymentStatus === 'Credit' && (
                      <span className="hidden sm:block w-1 h-1 rounded-full bg-brand-border" />
                    )}
                    <span className={cn(
                      "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border",
                      sale.paymentStatus === 'Cash' 
                        ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                        : "bg-orange-50 text-orange-600 border-orange-100"
                    )}>
                      {sale.paymentStatus === 'Cash' ? <Banknote size={10} /> : <CreditCard size={10} />}
                      {sale.paymentStatus}
                    </span>
                    {sale.returnStatus && (
                      <>
                        <span className="hidden sm:block w-1 h-1 rounded-full bg-brand-border" />
                        <span className={cn(
                          "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border",
                          sale.returnStatus === 'Returned' ? "bg-red-50 text-red-600 border-red-100" : "bg-orange-50 text-orange-600 border-orange-100"
                        )}>
                          <Undo2 size={10} />
                          {sale.returnStatus} {sale.returnedQuantity ? `(${sale.returnedQuantity})` : ''}
                        </span>
                      </>
                    )}
                    <span className="hidden sm:block w-1 h-1 rounded-full bg-brand-border" />
                    <span className={cn(
                      "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border",
                      (Number(sale.retailPrice) || 0) > 0 && (((Number(sale.retailPrice) || 0) - ((Number(sale.costAtSale) || 0) * (Number(sale.quantity) || 1))) / (Number(sale.retailPrice) || 1) * 100) > 30 
                        ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                        : "bg-brand-surface text-brand-muted border-brand-border"
                    )}>
                      Margin: {(Number(sale.retailPrice) || 0) > 0 ? ((((Number(sale.retailPrice) || 0) - ((Number(sale.costAtSale) || 0) * (Number(sale.quantity) || 1))) / (Number(sale.retailPrice) || 1)) * 100).toFixed(1) + '%' : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 lg:flex lg:items-center gap-4 lg:gap-12 text-left lg:text-right border-t lg:border-t-0 pt-6 lg:pt-0 border-brand-border/30">
                <div className="col-span-2 lg:order-last flex items-center justify-end gap-2">
                  {sale.paymentStatus === 'Credit' && (
                    <button 
                      onClick={() => handleUpdatePayment(sale)}
                      className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                      <CheckCircle2 size={14} />
                      Pay Now
                    </button>
                  )}
                  {sale.paymentStatus === 'Cash' && sale.returnStatus !== 'Returned' && (
                    <button 
                      onClick={() => setReturningSale(sale)}
                      className="flex items-center justify-center gap-2 bg-brand-surface text-brand-ink px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-surface/80 transition-colors border border-brand-border"
                    >
                      <Undo2 size={14} />
                      Return
                    </button>
                  )}
                  <button 
                    onClick={() => setEditingSale(sale)}
                    className="p-2 text-brand-muted hover:text-brand-ink transition-colors"
                    title="Edit Sale"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleDeleteSale(sale)}
                    className="p-2 text-brand-muted hover:text-red-600 transition-colors"
                    title="Delete Sale"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-muted mb-2">Sale Price</p>
                  <p className="text-xl sm:text-2xl font-light text-brand-ink">{formatCurrency(Number(sale.retailPrice) || 0)}</p>
                </div>
                <div className="hidden lg:block">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-muted mb-2">Margin</p>
                  <p className={cn(
                    "text-xl font-medium",
                    (Number(sale.retailPrice) || 0) > 0 && (((Number(sale.retailPrice) || 0) - ((Number(sale.costAtSale) || 0) * (Number(sale.quantity) || 1))) / (Number(sale.retailPrice) || 1) * 100) > 30 ? "text-emerald-600" : "text-brand-muted"
                  )}>
                    {(Number(sale.retailPrice) || 0) > 0 ? (((Number(sale.retailPrice) || 0) - ((Number(sale.costAtSale) || 0) * (Number(sale.quantity) || 1))) / (Number(sale.retailPrice) || 1) * 100).toFixed(1) + '%' : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent mb-2">Net Profit</p>
                  <p className="text-xl sm:text-2xl font-semibold text-brand-accent">{formatCurrency((Number(sale.retailPrice) || 0) - ((Number(sale.costAtSale) || 0) * (Number(sale.quantity) || 1)))}</p>
                </div>
              </div>
            </div>
          ))}
          {filteredSales.length === 0 && (
            <div className="py-20 text-center opacity-30 italic text-sm">No sales records found</div>
          )}
        </div>
      </div>
  );
}
