import React from 'react';
import { doc, collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { AppUser, AppMetrics } from '../types';
import { Users, ShoppingBag, TrendingUp, DollarSign, Calendar, Mail } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { motion } from 'framer-motion';

export function AdminDashboard() {
  const [users, setUsers] = React.useState<AppUser[]>([]);
  const [metrics, setMetrics] = React.useState<AppMetrics | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // We can't really "query" global metrics easily without a scheduled task 
    // unless we aggregate here (not ideal for large data).
    // For now, let's just listen to the users collection.
    const unsubscribeUsers = onSnapshot(
      query(collection(db, 'users'), orderBy('lastLogin', 'desc'), limit(50)),
      (snapshot) => {
        setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser)));
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'users')
    );

    // Listen to global metrics document if it exists
    const unsubscribeMetrics = onSnapshot(
      doc(db, 'metrics', 'global'),
      (snapshot) => {
        if (snapshot.exists()) {
          setMetrics(snapshot.data() as AppMetrics);
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'metrics/global')
    );

    return () => {
      unsubscribeUsers();
      unsubscribeMetrics();
    };
  }, []);

  const stats = [
    { label: 'Total App Users', value: users.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Recent Active Users', value: users.filter(u => u.lastLogin).length, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Admin Count', value: users.filter(u => u.isAdmin).length, icon: ShoppingBag, color: 'text-brand-accent', bg: 'bg-brand-surface' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header className="border-b border-brand-border pb-6">
        <h1 className="text-3xl md:text-4xl font-serif italic text-brand-accent leading-none">Admin Control Center</h1>
        <p className="text-[10px] md:text-xs text-brand-muted mt-2 font-medium tracking-widest uppercase">System Overview & Analytics</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-brand-border shadow-sm">
            <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center mb-6`}>
              <stat.icon size={24} />
            </div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-brand-muted mb-2">{stat.label}</p>
            <p className="text-4xl font-serif italic font-medium text-brand-ink">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[2.5rem] border border-brand-border shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-brand-border flex items-center justify-between">
          <h3 className="font-serif italic text-xl font-medium">Recent Users</h3>
          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">{users.length} registered</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-brand-surface text-brand-muted text-[10px] uppercase tracking-widest font-bold">
                <th className="px-8 py-4">User</th>
                <th className="px-8 py-4">Status</th>
                <th className="px-8 py-4">Joined</th>
                <th className="px-8 py-4 text-right">Last Session</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-surface">
              {users.map((u) => (
                <tr key={u.id} className="group hover:bg-brand-surface/40 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      {u.photoURL ? (
                        <img src={u.photoURL} alt="" className="w-10 h-10 rounded-full border border-brand-border" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-brand-surface flex items-center justify-center font-serif text-brand-accent">
                          {u.displayName ? u.displayName[0] : '?'}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-brand-ink">{u.displayName}</p>
                        <p className="text-xs text-brand-muted">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    {u.isAdmin ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-accent/10 text-brand-accent text-[9px] font-bold uppercase tracking-widest">
                        Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-bold uppercase tracking-widest">
                        Standard
                      </span>
                    )}
                  </td>
                  <td className="px-8 py-6 text-xs text-brand-muted">
                    {u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString() : 'Initial'}
                  </td>
                  <td className="px-8 py-6 text-right text-xs text-brand-muted font-mono">
                    {u.lastLogin?.toDate ? u.lastLogin.toDate().toLocaleString() : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}


