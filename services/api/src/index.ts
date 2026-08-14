import express from 'express';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 8080;

app.use(express.json());

// Health check — the ALB hits this to determine task health
app.get('/', (req, res) => {
  res.status(200).send('NexusRetail API is alive');
});

// First real endpoint: list products for a tenant
app.get('/products', async (req, res) => {
  try {
    // Hardcoded tenant for now — real auth/tenant-context comes later
    const tenant = await prisma.tenant.findFirst();

    if (!tenant) {
      return res.status(404).json({ error: 'No tenant found' });
    }

    const products = await prisma.product.findMany({
      where: { tenantId: tenant.id },
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

app.listen(PORT, () => {
  console.log(`NexusRetail API listening on port ${PORT}`);
});

// List all orders for the tenant
app.get('/orders', async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) return res.status(404).json({ error: 'No tenant found' });

    const orders = await prisma.order.findMany({
      where: { tenantId: tenant.id },
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

// Get a single order's full detail
app.get('/orders/:id', async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        items: {
          include: { product: true },
        },
      },
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Update an order's status
app.patch('/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['placed', 'stock_reserved', 'payment', 'fulfilled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
    });

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
