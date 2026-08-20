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

  if (res.status === 204) {
    return undefined as T;
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

export interface Warehouse {
  id: string;
  name: string;
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

export interface Supplier {
  id: string;
  name: string;
}

export interface PurchaseOrderItem {
  id: string;
  expectedQty: number;
  expectedUnitPrice: string;
  product: Product;
}

export interface LineMatchResult {
  description: string;
  extractedQty: number | null;
  expectedQty: number;
  extractedUnitPrice: number | null;
  expectedUnitPrice: number;
  qtyMatch: boolean;
  priceMatch: boolean;
}

export interface PurchaseOrder {
  id: string;
  status: string;
  matchDetails: LineMatchResult[] | null;
  createdAt: string;
  supplier: Supplier;
  items: PurchaseOrderItem[];
}

export const api = {
  getProducts: () => request<Product[]>('/products'),
  createProduct: (data: { sku: string; name: string; unitPrice: string; reorderPoint: number; warehouseId: string; initialQuantity: number }) =>
    request<Product>('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProductStock: (productId: string, warehouseId: string, quantityOnHand: number) =>
    request<StockLevel>(`/products/${productId}/stock`, {
      method: 'PATCH',
      body: JSON.stringify({ warehouseId, quantityOnHand }),
    }),
  deleteProduct: (id: string) => request<void>(`/products/${id}`, { method: 'DELETE' }),
  getWarehouses: () => request<Warehouse[]>('/warehouses'),
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
  getPurchaseOrders: () => request<PurchaseOrder[]>('/purchase-orders'),
  getPurchaseOrder: (id: string) => request<PurchaseOrder>(`/purchase-orders/${id}`),
  approvePurchaseOrder: (id: string) =>
    request<{ updated: { productId: string; newQuantity: number }[] }>(`/purchase-orders/${id}/approve`, {
      method: 'POST',
    }),
  uploadInvoice: async (file: File) => {
    const token = getIdToken();
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${BASE_URL}/invoices/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.error || `Request failed: ${res.status}`);
    }
    return body as {
      purchaseOrderId: string;
      poNumber: string;
      vendorName: string | null;
      status: string;
      lineResults: LineMatchResult[];
    };
  },
};