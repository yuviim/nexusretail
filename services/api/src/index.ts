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
