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
  const totalSpent = products.reduce((sum, p) => sum + p.cost, 0);
  const totalRevenue = sales.reduce((sum, s) => sum + (s.retailPrice * (s.quantity || 1)), 0);
  const totalCostOfSold = sales.reduce((sum, s) => sum + (s.costAtSale * (s.quantity || 1)), 0);
  const totalCreditSales = sales
    .filter(s => s.paymentStatus === 'Credit')
    .reduce((sum, s) => sum + (s.retailPrice * (s.quantity || 1)), 0);
  
  const netProfit = totalRevenue - totalCostOfSold;
  
  const profitMargin = totalRevenue > 0 
    ? ((totalRevenue - totalCostOfSold) / totalRevenue) * 100 
    : 0;

  const stats = [
    { label: 'Inventory Cost', value: formatCurrency(totalSpent), icon: IndianRupee, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { label: 'Total Revenue', value: formatCurrency(totalRevenue), icon: ShoppingCart, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
    { label: 'Total Credit', value: formatCurrency(totalCreditSales), icon: TrendingDown, color: 'text-amber-600', bgColor: 'bg-amber-50' },
    { label: 'Net Profit', value: formatCurrency(netProfit), icon: TrendingUp, color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
    { label: 'Profit Margin', value: `${profitMargin.toFixed(1)}%`, icon: Gem, color: 'text-brand-accent', bgColor: 'bg-brand-accent/5' },
  ];

  // Data for charts
  const categoryData = products.reduce((acc: any[], p) => {
    const existing = acc.find(item => item.name === p.category);
    if (existing) {
      existing.value += 1;
    } else {
      acc.push({ name: p.category, value: 1 });
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-[2.5rem] border border-brand-border shadow-sm transition-all hover:shadow-md flex flex-col items-start gap-4 h-full min-h-[160px]">
            <div className={cn("p-3 rounded-2xl", stat.bgColor)}>
              <stat.icon className={cn("w-5 h-5", stat.color)} />
            </div>
            <div>
              <p className="text-[10px] text-brand-muted font-bold uppercase tracking-[0.2em] mb-1.5">{stat.label}</p>
              <p className="text-xl sm:text-2xl font-light text-brand-ink leading-tight break-all font-mono tracking-tighter">
                {stat.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-5 bg-brand-surface/50 p-10 rounded-[2.5rem] border border-brand-border">
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
            {sales.slice(0, 5).map((sale, i) => (
              <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 bg-brand-surface/40 rounded-2xl border border-brand-border/50 group hover:border-brand-accent/30 transition-all gap-4">
                <div>
                  <p className="text-sm font-semibold text-brand-ink">{sale.productName}</p>
                  <p className="text-[10px] text-brand-muted uppercase font-bold tracking-widest mt-1">Sold to {sale.customerName}</p>
                </div>
                <div className="text-left sm:text-right w-full sm:w-auto border-t sm:border-t-0 pt-4 sm:pt-0 border-brand-border/30">
                  <p className="text-sm font-bold text-brand-accent">+{formatCurrency(sale.retailPrice * (sale.quantity || 1))}</p>
                  <p className="text-[10px] text-brand-muted font-medium opacity-60">Profit: {formatCurrency((sale.retailPrice - sale.costAtSale) * (sale.quantity || 1))}</p>
                </div>
              </div>
            ))}
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
  );
}
