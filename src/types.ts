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
  status: 'In Stock' | 'Sold';
  quantity: number;
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
  quantity: number;
  retailPrice: number;
  costAtSale: number;
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

export type View = 'dashboard' | 'inventory' | 'sales' | 'contacts' | 'admin';
