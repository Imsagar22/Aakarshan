import React from 'react';
import { UserPlus, Mail, Phone, Building2, User as UserIcon, Trash2, Search } from 'lucide-react';
import { Contact } from '../types';
import { collection, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { cn } from '../lib/utils';

import { type User } from 'firebase/auth';

interface ContactsProps {
  contacts: Contact[];
  user: User;
}

export function Contacts({ contacts, user }: ContactsProps) {
  const [isAdding, setIsAdding] = React.useState(false);
  const [filterType, setFilterType] = React.useState<'All' | 'wholesaler' | 'customer'>('All');
  const [searchTerm, setSearchTerm] = React.useState('');

  async function handleAddContact(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const contactData: any = {
      userId: user.uid,
      name: formData.get('name') as string,
      type: formData.get('type') as string,
      createdAt: serverTimestamp(),
    };

    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string;
    
    if (email) contactData.email = email;
    if (phone) contactData.phone = phone;

    console.log('Attempting to add contact:', contactData);
    try {
      const docRef = await addDoc(collection(db, 'contacts'), contactData);
      console.log('Contact added successfully with ID:', docRef.id);
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'contacts');
    }
  }

  const filteredContacts = contacts
    .filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           c.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'All' || c.type === filterType;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-brand-border pb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif italic text-brand-accent leading-none">Primary Contacts</h1>
          <p className="text-[10px] md:text-xs text-brand-muted mt-2 font-medium tracking-widest uppercase">Wholesalers & Customers</p>
        </div>
        <button 
          id="new-contact-button"
          onClick={() => setIsAdding(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-brand-accent text-white px-8 py-3 rounded-full font-bold text-[11px] uppercase tracking-widest hover:scale-105 transition-all shadow-lg"
        >
          <UserPlus size={16} />
          New Contact
        </button>
      </header>

      {isAdding && (
        <div className="fixed inset-0 bg-brand-ink/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-2xl font-bold">New Contact</h3>
              <button 
                id="close-contact-modal"
                onClick={() => setIsAdding(false)} 
                className="opacity-40 hover:opacity-100 transition-opacity"
              >
                <UserPlus className="rotate-45" />
              </button>
            </div>
            <form onSubmit={handleAddContact} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Full Name / Company</label>
                <input required name="name" className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" placeholder="Name" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Contact Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 p-3 rounded-xl border border-brand-ink/5 bg-brand-bg cursor-pointer has-[:checked]:border-brand-accent has-[:checked]:bg-brand-accent/5 transition-all">
                    <input required type="radio" name="type" value="wholesaler" className="hidden" defaultChecked />
                    <Building2 size={16} />
                    <span className="text-xs font-bold uppercase tracking-widest">Wholesaler</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 rounded-xl border border-brand-ink/5 bg-brand-bg cursor-pointer has-[:checked]:border-brand-accent has-[:checked]:bg-brand-accent/5 transition-all">
                    <input required type="radio" name="type" value="customer" className="hidden" />
                    <UserIcon size={16} />
                    <span className="text-xs font-bold uppercase tracking-widest">Customer</span>
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Email</label>
                  <input type="email" name="email" className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" placeholder="email@example.com" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2 block">Phone</label>
                  <input type="tel" name="phone" className="w-full bg-brand-bg px-4 py-3 rounded-xl border border-brand-ink/5" placeholder="+1..." />
                </div>
              </div>
              <button 
                id="save-contact-button"
                type="submit" 
                className="w-full bg-brand-ink text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-xs mt-4 hover:bg-brand-ink/90 transition-colors"
              >
                Save Contact
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tabs & Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-20" size={18} />
          <input 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white rounded-2xl text-sm border-none shadow-sm focus:ring-1 ring-brand-accent/20" 
            placeholder="Search contacts..." 
          />
        </div>
        <div className="flex p-1 bg-white rounded-2xl shadow-sm self-start">
          {(['All', 'wholesaler', 'customer'] as const).map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={cn(
                "px-6 py-2 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all",
                filterType === type ? "bg-brand-accent text-white shadow-md" : "opacity-40 hover:opacity-100"
              )}
            >
              {type === 'wholesaler' ? 'Wholesalers' : type === 'customer' ? 'Customers' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        {filteredContacts.map((contact) => (
          <div key={contact.id} className="bg-white p-6 sm:p-10 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-brand-border/50 group hover:shadow-md transition-all relative overflow-hidden">
            <div className="flex items-start justify-between mb-6 sm:mb-8">
              <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-brand-surface flex items-center justify-center font-serif text-xl sm:text-2xl text-brand-accent shadow-inner">
                {contact.name[0]}
              </div>
              <span className="text-[10px] text-brand-muted uppercase tracking-[0.2em] font-semibold">
                {contact.type}
              </span>
            </div>

            <h4 className="font-serif italic text-xl sm:text-2xl font-medium mb-4 sm:mb-6 text-brand-ink">{contact.name}</h4>
            
            <div className="space-y-3 font-medium text-brand-muted">
              {contact.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail size={14} className="opacity-40" />
                  <span className="truncate tracking-wide">{contact.email}</span>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone size={14} className="opacity-40" />
                  <span className="tracking-widest">{contact.phone}</span>
                </div>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-brand-ink/5 flex justify-end">
              <button 
                onClick={async () => {
                   if(confirm('Delete this contact?')) {
                      try { await deleteDoc(doc(db, 'contacts', contact.id)); }
                      catch(e) { handleFirestoreError(e, OperationType.DELETE, `contacts/${contact.id}`); }
                   }
                }}
                className="p-2 text-brand-ink/20 hover:text-red-500 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        {filteredContacts.length === 0 && (
          <div className="col-span-full py-20 text-center opacity-30 italic text-sm">No contacts found</div>
        )}
      </div>
    </div>
  );
}
