import express from 'express';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { requireAuth, AuthenticatedRequest } from './middleware/auth';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 8080;

app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).send('NexusRetail API is alive');
});

app.get('/products', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { tenantId: req.tenantId },
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

app.get('/orders', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { tenantId: req.tenantId },
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

app.get('/orders/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
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
    const { status } = req.body;
    const validStatuses = ['placed', 'stock_reserved', 'payment', 'fulfilled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.tenantId !== req.tenantId) {
      return res.status(404).json({ error: 'Order not found' });
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

app.listen(PORT, () => {
  console.log(`NexusRetail API listening on port ${PORT}`);
});