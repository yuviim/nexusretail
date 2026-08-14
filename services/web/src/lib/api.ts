import { getIdToken } from './auth';

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getIdToken();

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    localStorage.removeItem('nexusretail_id_token');
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

export interface StockLevel {
  id: string;
  quantityOnHand: number;
  warehouse: { id: string; name: string };
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  unitPrice: string;
  reorderPoint: number;
  stockLevels: StockLevel[];
}

export interface Customer {
  id: string;
  name: string;
}

export interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: string;
  product: Product;
}

export interface Order {
  id: string;
  status: string;
  createdAt: string;
  customer: Customer;
  items: OrderItem[];
}

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  createdAt: string;
  _count: { users: number; products: number; orders: number };
}

export const api = {
  getProducts: () => request<Product[]>('/products'),
  getOrders: () => request<Order[]>('/orders'),
  getOrder: (id: string) => request<Order>(`/orders/${id}`),
  updateOrderStatus: (id: string, status: string) =>
    request<Order>(`/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  getCustomers: () => request<Customer[]>('/customers'),
  createOrder: (customerId: string, items: { productId: string; quantity: number }[]) =>
    request<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify({ customerId, items }),
    }),
  getTeam: () => request<TeamMember[]>('/team'),
  inviteTeamMember: (email: string, name: string, role: string) =>
    request<TeamMember>('/team', {
      method: 'POST',
      body: JSON.stringify({ email, name, role }),
    }),
  getTenants: () => request<Tenant[]>('/admin/tenants'),
};
