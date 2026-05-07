export interface Contact {
  id: string;
  userId: string;
  name: string;
  type: 'wholesaler' | 'customer';
  email?: string;
  phone?: string;
  createdAt: any;
}

export interface Product {
  id: string;
  userId: string;
  name: string;
  category: string;
  wholesalerId: string;
  wholesalerName: string;
  cost: number;
  quantity: number;
  status: 'In Stock' | 'Sold';
  purchaseDate: string;
  createdAt: any;
}

export interface Sale {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  customerId: string;
  customerName: string;
  retailPrice: number;
  costAtSale: number;
  quantity: number;
  paymentStatus: 'Cash' | 'Credit';
  dueDate?: string;
  saleDate: string;
  createdAt: any;
}

export interface AppUser {
  id: string;
  email: string;
  displayName: string;
  photoURL: string;
  lastLogin: any;
  createdAt: any;
  isAdmin: boolean;
}

export interface AppMetrics {
  totalUsers: number;
  totalSalesCount: number;
  totalInventoryValue: number;
  totalRevenue: number;
  updatedAt: any;
}

export interface InventoryLog {
  id: string;
  userId: string;
  productId: string;
  type: 'sale' | 'restock' | 'adjustment';
  quantityChange: number;
  note: string;
  date: string;
  createdAt: any;
}

export type View = 'dashboard' | 'inventory' | 'sales' | 'contacts' | 'admin';
