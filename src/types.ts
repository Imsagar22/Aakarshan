export interface Contact {
  id: string;
  name: string;
  type: 'wholesaler' | 'customer';
  email?: string;
  phone?: string;
  createdAt: any;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  wholesalerId: string;
  wholesalerName: string;
  cost: number;
  status: 'In Stock' | 'Sold';
  purchaseDate: string;
  createdAt: any;
}

export interface Sale {
  id: string;
  productId: string;
  productName: string;
  customerId: string;
  customerName: string;
  retailPrice: number;
  costAtSale: number;
  saleDate: string;
  createdAt: any;
}

export type View = 'dashboard' | 'inventory' | 'sales' | 'contacts';
