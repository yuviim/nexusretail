import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { requireAuth, requireSuperAdmin, AuthenticatedRequest } from './middleware/auth';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import morgan from 'morgan';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 8080;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const s3 = new S3Client({ region: process.env.AWS_REGION || 'eu-central-1' });
const INVOICES_BUCKET = 'nexusretail-dev-invoices-102268067799';

app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).send('NexusRetail API is alive');
});

app.get('/products', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { tenantId: req.tenantId as string },
      include: { stockLevels: { include: { warehouse: true } } },
    });
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/products', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { sku, name, unitPrice, reorderPoint, warehouseId, initialQuantity } = req.body as {
      sku: string; name: string; unitPrice: string; reorderPoint: number;
      warehouseId: string; initialQuantity: number;
    };

    if (!sku || !name || !unitPrice || !warehouseId) {
      return res.status(400).json({ error: 'sku, name, unitPrice, and warehouseId are required' });
    }

    const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse || warehouse.tenantId !== req.tenantId) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }

    const product = await prisma.product.create({
      data: {
        tenantId: req.tenantId as string,
        sku, name, unitPrice, reorderPoint: reorderPoint ?? 0,
        stockLevels: {
          create: [{ warehouseId, quantityOnHand: initialQuantity ?? 0 }],
        },
      },
      include: { stockLevels: { include: { warehouse: true } } },
    });

    res.status(201).json(product);
  } catch (err: any) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'A product with this SKU already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/products/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const productId = req.params.id as string;
    const existing = await prisma.product.findUnique({ where: { id: productId } });
    if (!existing || existing.tenantId !== req.tenantId) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const { name, unitPrice, reorderPoint } = req.body;
    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        ...(name && { name }),
        ...(unitPrice && { unitPrice }),
        ...(reorderPoint !== undefined && { reorderPoint }),
      },
      include: { stockLevels: { include: { warehouse: true } } },
    });

    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/products/:id/stock', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const productId = req.params.id as string;
    const { warehouseId, quantityOnHand } = req.body as { warehouseId: string; quantityOnHand: number };

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.tenantId !== req.tenantId) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const stockLevel = await prisma.stockLevel.upsert({
      where: { productId_warehouseId: { productId, warehouseId } },
      update: { quantityOnHand },
      create: { productId, warehouseId, quantityOnHand },
    });

    res.json(stockLevel);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/products/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const productId = req.params.id as string;
    const existing = await prisma.product.findUnique({ where: { id: productId } });
    if (!existing || existing.tenantId !== req.tenantId) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await prisma.stockLevel.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });

    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2003') {
      return res.status(409).json({ error: 'Cannot delete a product that has existing orders' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/warehouses', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const warehouses = await prisma.warehouse.findMany({
      where: { tenantId: req.tenantId as string },
      orderBy: { name: 'asc' },
    });
    res.json(warehouses);
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
      include: { customer: true, items: { include: { product: true } } },
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
      include: { customer: true, items: { include: { product: true } } },
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

    const order = await prisma.order.update({ where: { id: orderId }, data: { status } });
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
      include: { _count: { select: { users: true, products: true, orders: true } } },
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

app.get('/purchase-orders', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const pos = await prisma.purchaseOrder.findMany({
      where: { tenantId: req.tenantId as string },
      include: { supplier: true, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(pos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/purchase-orders/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: req.params.id as string },
      include: { supplier: true, items: { include: { product: true } } },
    });

    if (!po || po.tenantId !== req.tenantId) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    res.json(po);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/purchase-orders/:id/approve', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { updateStock } = await import('./agents/tools/updateStock');
    const result = await updateStock(req.tenantId as string, req.params.id as string);
    res.json(result);
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to approve purchase order' });
  }
});

app.post('/invoices/upload', requireAuth, upload.single('file'), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { extractInvoice } = await import('./agents/tools/extractInvoice');
    const { findPurchaseOrderByNumber } = await import('./agents/tools/findPurchaseOrderByNumber');
    const { matchPurchaseOrder } = await import('./agents/tools/matchPurchaseOrder');

    const s3Key = `uploads/${Date.now()}-${req.file.originalname}`;
    console.log(`[invoice-upload] received file "${req.file.originalname}" (${req.file.size} bytes), tenant=${req.tenantId}`);

    await s3.send(new PutObjectCommand({
      Bucket: INVOICES_BUCKET,
      Key: s3Key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }));
    console.log(`[invoice-upload] stored in S3 at s3://${INVOICES_BUCKET}/${s3Key}`);

    const invoice = await extractInvoice(INVOICES_BUCKET, s3Key);
    console.log(`[invoice-upload] Textract extraction complete: vendor="${invoice.vendorName}", poNumber="${invoice.poNumber || 'NOT FOUND'}"`);

    if (!invoice.poNumber) {
      console.log(`[invoice-upload] no PO number extracted — stopping, no automatic match attempted`);
      return res.status(422).json({
        error: 'No PO number found on this invoice. Unable to automatically match it to a purchase order.',
        invoice,
      });
    }

    const po = await findPurchaseOrderByNumber(req.tenantId as string, invoice.poNumber);
    console.log(`[invoice-upload] found matching PO: ${po.id} (${invoice.poNumber})`);
    const result = await matchPurchaseOrder(req.tenantId as string, po.id, invoice);
    console.log(`[invoice-upload] match result: status="${result.status}" for PO ${po.id}`);

    res.json({
      purchaseOrderId: po.id,
      poNumber: invoice.poNumber,
      vendorName: invoice.vendorName,
      status: result.status,
      lineResults: result.lineResults,
    });
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to process invoice' });
  }
});

app.listen(PORT, () => {
  console.log(`NexusRetail API listening on port ${PORT}`);
});