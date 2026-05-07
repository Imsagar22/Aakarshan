import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { TrendingUp, TrendingDown, IndianRupee, Gem, ShoppingCart } from 'lucide-react';
import { Product, Sale } from '../types';
import { formatCurrency, cn } from '../lib/utils';

interface DashboardProps {
  products: Product[];
  sales: Sale[];
}

export function Dashboard({ products, sales }: DashboardProps) {
  const totalRevenue = sales.reduce((sum, s) => sum + (Number(s.retailPrice) || 0), 0);
  const totalCashRevenue = sales.filter(s => s.paymentStatus === 'Cash').reduce((sum, s) => sum + (Number(s.retailPrice) || 0), 0);
  const totalOutstandingCredit = sales.filter(s => s.paymentStatus === 'Credit').reduce((sum, s) => sum + (Number(s.retailPrice) || 0), 0);
  
  const currentStockValue = products.reduce((sum, p) => sum + ((Number(p.cost) || 0) * (Number(p.quantity) || 0)), 0);
  const costOfGoodsSold = sales.reduce((sum, s) => sum + ((Number(s.costAtSale) || 0) * (Number(s.quantity) || 1)), 0);
  const totalInvestment = currentStockValue + costOfGoodsSold;
  const netProfit = totalRevenue - costOfGoodsSold;
  
  const profitMargin = totalRevenue > 0 
    ? ((totalRevenue - costOfGoodsSold) / totalRevenue) * 100 
    : 0;

  const stats = [
    { label: 'Total Revenue', value: formatCurrency(totalRevenue) },
    { label: 'Stock Value (Real-time)', value: formatCurrency(currentStockValue) },
    { label: 'Total Investment', value: formatCurrency(totalInvestment) },
    { label: 'Net Profit', value: formatCurrency(netProfit) },
  ];

  // Data for charts
  const categoryData = products.reduce((acc: any[], p) => {
    const existing = acc.find(item => item.name === p.category);
    const qty = p.quantity || 1;
    if (existing) {
      existing.value += qty;
    } else {
      acc.push({ name: p.category, value: qty });
    }
    return acc;
  }, []);

  const COLORS = ['#5A5A40', '#8E8E6B', '#3D3D2B', '#A8A88F', '#1A1A11'];

  return (
    <div className="space-y-12">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-brand-border pb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif italic text-brand-accent leading-none">Boutique Performance</h1>
          <p className="text-[10px] md:text-xs text-brand-muted mt-2 font-medium tracking-widest uppercase">Admin Dashboard</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-8 rounded-[2rem] border border-brand-border/50 shadow-sm transition-all hover:shadow-md">
            <p className="text-[10px] text-brand-muted font-bold uppercase tracking-[0.2em] mb-2">{stat.label}</p>
            <p className={cn(
              "text-3xl font-light leading-none",
              stat.label === 'Net Profit' ? (netProfit >= 0 ? "text-emerald-600" : "text-red-500") : "text-brand-ink"
            )}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-brand-surface p-6 rounded-2xl border border-brand-border/30 flex justify-between items-center">
          <div>
            <p className="text-[9px] uppercase font-bold tracking-widest text-brand-muted mb-1">Cash Performance</p>
            <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalCashRevenue)}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase font-bold tracking-widest text-brand-muted mb-1">Uncollected Credit</p>
            <p className="text-xl font-bold text-orange-500">{formatCurrency(totalOutstandingCredit)}</p>
          </div>
        </div>
        <div className="bg-brand-surface p-6 rounded-2xl border border-brand-border/30 flex justify-between items-center">
          <div>
            <p className="text-[9px] uppercase font-bold tracking-widest text-brand-muted mb-1">Total Assets (Stock + Cash)</p>
            <p className="text-xl font-bold text-brand-ink">{formatCurrency(currentStockValue + totalCashRevenue)}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase font-bold tracking-widest text-brand-muted mb-1">Profit Margin</p>
            <p className="text-xl font-bold text-brand-accent">{profitMargin.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-12 bg-brand-surface/50 p-10 rounded-[2.5rem] border border-brand-border">
          <h3 className="font-serif text-2xl italic mb-8">Outstanding Credits</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-y-4">
              <thead>
                <tr>
                  <th className="px-6 text-[10px] uppercase font-bold tracking-widest text-brand-muted opacity-60">Customer</th>
                  <th className="px-6 text-[10px] uppercase font-bold tracking-widest text-brand-muted opacity-60">Product</th>
                  <th className="px-6 text-[10px] uppercase font-bold tracking-widest text-brand-muted opacity-60">Amount</th>
                  <th className="px-6 text-[10px] uppercase font-bold tracking-widest text-brand-muted opacity-60">Margin</th>
                  <th className="px-6 text-[10px] uppercase font-bold tracking-widest text-brand-muted opacity-60">Due Date</th>
                </tr>
              </thead>
              <tbody className="space-y-4">
                {sales
                  .filter(s => s.paymentStatus === 'Credit')
                  .sort((a, b) => {
                    if (!a.dueDate) return 1;
                    if (!b.dueDate) return -1;
                    return a.dueDate.localeCompare(b.dueDate);
                  })
                  .map((sale, i) => {
                    const profit = (Number(sale.retailPrice) || 0) - ((Number(sale.costAtSale) || 0) * (Number(sale.quantity) || 1));
                    const margin = (Number(sale.retailPrice) || 0) > 0 ? (profit / (Number(sale.retailPrice) || 0)) * 100 : 0;
                    
                    return (
                      <tr key={i} className="bg-white border-y border-brand-border shadow-sm group">
                        <td className="px-6 py-4 rounded-l-2xl border-l border-y border-brand-border">
                          <p className="text-sm font-bold text-brand-ink">{sale.customerName}</p>
                        </td>
                        <td className="px-6 py-4 border-y border-brand-border">
                          <p className="text-sm text-brand-ink">{sale.productName}</p>
                        </td>
                        <td className="px-6 py-4 border-y border-brand-border">
                          <p className="text-sm font-mono font-bold text-orange-600">{formatCurrency(Number(sale.retailPrice) || 0)}</p>
                        </td>
                        <td className="px-6 py-4 border-y border-brand-border">
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full",
                            margin > 30 ? "bg-emerald-50 text-emerald-600" : "bg-brand-surface text-brand-muted"
                          )}>
                            {margin.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 rounded-r-2xl border-r border-y border-brand-border">
                          {sale.dueDate ? (
                            <div className="flex items-center gap-3">
                              <span className={cn(
                                "text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full",
                                new Date(sale.dueDate) < new Date() ? "bg-red-50 text-red-600" : "bg-orange-50 text-orange-600"
                              )}>
                                {sale.dueDate}
                              </span>
                              {new Date(sale.dueDate) < new Date() && (
                                <span className="text-[8px] font-bold text-red-600 uppercase animate-pulse">Overdue</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[9px] text-brand-muted italic uppercase tracking-widest">No date set</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
            {sales.filter(s => s.paymentStatus === 'Credit').length === 0 && (
              <div className="h-40 flex items-center justify-center opacity-30 italic text-sm">
                No outstanding credits
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-5 bg-brand-surface/50 p-10 rounded-[2.5rem] border border-brand-border h-fit">
            <h3 className="font-serif text-2xl italic mb-8">Category Distribution</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {categoryData.map((entry, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">{entry.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7 bg-white p-10 rounded-[2.5rem] border border-brand-border">
            <h3 className="font-serif text-2xl italic mb-8">Recent Activity</h3>
            <div className="space-y-6">
              {sales.slice(0, 5).map((sale, i) => {
                const profit = (Number(sale.retailPrice) || 0) - ((Number(sale.costAtSale) || 0) * (Number(sale.quantity) || 1));
                const margin = (Number(sale.retailPrice) || 0) > 0 ? (profit / (Number(sale.retailPrice) || 0)) * 100 : 0;
                
                return (
                  <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 bg-brand-surface/40 rounded-2xl border border-brand-border/50 group hover:border-brand-accent/30 transition-all gap-4">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        sale.paymentStatus === 'Cash' ? "bg-emerald-500" : "bg-orange-500"
                      )} />
                      <div>
                        <p className="text-sm font-semibold text-brand-ink">{sale.productName}</p>
                        <p className="text-[10px] text-brand-muted uppercase font-bold tracking-widest mt-1">{Number(sale.quantity) || 1} { (Number(sale.quantity) || 1) === 1 ? 'unit' : 'units'} sold to {sale.customerName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-left sm:text-right w-full sm:w-auto border-t sm:border-t-0 pt-4 sm:pt-0 border-brand-border/30">
                      <div className="hidden sm:block">
                        <p className="text-[10px] uppercase font-bold tracking-widest text-brand-muted opacity-60">Margin</p>
                        <p className={cn(
                          "text-xs font-bold",
                          margin > 30 ? "text-emerald-600" : "text-brand-muted"
                        )}>{margin.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-brand-accent">+{formatCurrency(Number(sale.retailPrice) || 0)}</p>
                        <p className={cn(
                          "text-[10px] uppercase font-bold tracking-widest",
                          sale.paymentStatus === 'Cash' ? "text-emerald-600" : "text-orange-600"
                        )}>
                          {sale.paymentStatus}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {sales.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 opacity-20">
                  <ShoppingCart size={32} className="mb-4" />
                  <p className="text-[10px] uppercase tracking-widest font-bold">No recent sales</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
