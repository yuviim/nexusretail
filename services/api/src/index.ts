import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { requireAuth, requireSuperAdmin, AuthenticatedRequest } from './middleware/auth';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).send('NexusRetail API is alive');
});

app.get('/products', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { tenantId: req.tenantId as string },
      include: {
        stockLevels: {
          include: { warehouse: true },
        },
      },
    });

    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/customers', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const customers = await prisma.customer.findMany({
      where: { tenantId: req.tenantId as string },
      orderBy: { name: 'asc' },
    });
    res.json(customers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/orders', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { tenantId: req.tenantId as string },
      include: {
        customer: true,
        items: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/orders', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { customerId, items } = req.body as {
      customerId: string;
      items: { productId: string; quantity: number }[];
    };

    if (!customerId || !items?.length) {
      return res.status(400).json({ error: 'customerId and at least one item are required' });
    }

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer || customer.tenantId !== req.tenantId) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const products = await prisma.product.findMany({
      where: { id: { in: items.map((i) => i.productId) }, tenantId: req.tenantId as string },
    });
    if (products.length !== items.length) {
      return res.status(400).json({ error: 'One or more products not found' });
    }

    const order = await prisma.order.create({
      data: {
        tenantId: req.tenantId as string,
        customerId,
        status: 'placed',
        items: {
          create: items.map((i) => {
            const product = products.find((p) => p.id === i.productId)!;
            return { productId: i.productId, quantity: i.quantity, unitPrice: product.unitPrice };
          }),
        },
      },
      include: { customer: true, items: { include: { product: true } } },
    });

    res.status(201).json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/orders/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const orderId = req.params.id as string;
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: {
          include: { product: true },
        },
      },
    });

    if (!order || order.tenantId !== req.tenantId) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/orders/:id/status', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const orderId = req.params.id as string;
    const { status } = req.body;
    const validStatuses = ['placed', 'stock_reserved', 'payment', 'fulfilled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const existing = await prisma.order.findUnique({ where: { id: orderId } });
    if (!existing || existing.tenantId !== req.tenantId) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status },
    });

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/team', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { tenantId: req.tenantId as string },
      orderBy: { createdAt: 'asc' },
    });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/team', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { email, name, role } = req.body as { email: string; name: string; role: string };
    const validRoles = ['owner', 'staff', 'read_only'];

    if (!email || !name || !validRoles.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${validRoles.join(', ')}` });
    }

    const user = await prisma.user.create({
      data: { tenantId: req.tenantId as string, email, name, role },
    });

    res.status(201).json(user);
  } catch (err: any) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/admin/tenants', requireSuperAdmin, async (req, res) => {
  try {
    const tenants = await prisma.tenant.findMany({
      include: {
        _count: {
          select: { users: true, products: true, orders: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(tenants);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/admin/tenants/:id', requireSuperAdmin, async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id as string },
      include: {
        users: true,
        products: { include: { stockLevels: { include: { warehouse: true } } } },
        orders: { include: { customer: true, items: { include: { product: true } } } },
        warehouses: true,
      },
    });

    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    res.json(tenant);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`NexusRetail API listening on port ${PORT}`);
});
