import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { prisma } from './prisma';
import { requireAuth, requireSuperAdmin, requireRole, AuthenticatedRequest, AUTH_MODE, encodeLocalToken } from './middleware/auth';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  UsernameExistsException,
} from '@aws-sdk/client-cognito-identity-provider';
import morgan from 'morgan';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const s3 = new S3Client({ region: process.env.AWS_REGION || 'eu-central-1' });
const INVOICES_BUCKET = process.env.INVOICES_BUCKET || 'nexusretail-dev-invoices-102268067799';
const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'eu-central-1' });
// Not asserted non-null here (see middleware/auth.ts for why) — reading it
// unconditionally at module scope with `!` was the other place the API
// crashed on startup without real Cognito config, even though this value
// is only actually needed inside the /team route below, and only when
// AUTH_MODE isn't 'local'.
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;

// cors() with no options reflects whatever Origin header shows up, which is
// the same as allowing every origin. ALLOWED_ORIGIN is set per environment
// (the CloudFront app domain in dev/prod); falls back to the known dev
// frontend so this doesn't silently open up if the env var is missing.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://app.nexusretail.yuvarajai.com';
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(morgan('combined'));
app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).send('NexusRetail API is alive');
});

// Only registered — doesn't exist as a route at all — when AUTH_MODE is
// 'local', which middleware/auth.ts already refuses to allow under
// NODE_ENV=production. Trades a real Cognito sign-in (InitiateAuth against
// a real user pool, needs an AWS account) for looking up one of the users
// prisma/seed.ts created by email and handing back a local dev token
// encoding their real cognitoSub, so requireAuth resolves it to the exact
// same tenant/user a real sign-in would.
if (AUTH_MODE === 'local') {
  app.post('/auth/local-login', async (req, res) => {
    const { email } = req.body as { email?: string };
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.cognitoSub) {
      return res.status(404).json({ error: 'No local user with that email. Run `npx prisma db seed`?' });
    }
    const token = encodeLocalToken({ sub: user.cognitoSub, email_verified: true, email: user.email });
    res.json({ token, email: user.email, role: user.role });
  });
}

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

app.post('/products', requireAuth, requireRole('owner', 'staff'), async (req: AuthenticatedRequest, res) => {
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

app.patch('/products/:id', requireAuth, requireRole('owner', 'staff'), async (req: AuthenticatedRequest, res) => {
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

app.patch('/products/:id/stock', requireAuth, requireRole('owner', 'staff'), async (req: AuthenticatedRequest, res) => {
  try {
    const productId = req.params.id as string;
    const { warehouseId, quantityOnHand } = req.body as { warehouseId: string; quantityOnHand: number };

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.tenantId !== req.tenantId) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // warehouseId comes straight from the request body — without this check
    // a caller could write stock rows against another tenant's warehouse
    // just by guessing or enumerating warehouse UUIDs.
    const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse || warehouse.tenantId !== req.tenantId) {
      return res.status(404).json({ error: 'Warehouse not found' });
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

app.delete('/products/:id', requireAuth, requireRole('owner', 'staff'), async (req: AuthenticatedRequest, res) => {
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

app.post('/orders', requireAuth, requireRole('owner', 'staff'), async (req: AuthenticatedRequest, res) => {
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

app.patch('/orders/:id/status', requireAuth, requireRole('owner', 'staff'), async (req: AuthenticatedRequest, res) => {
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

app.post('/team', requireAuth, requireRole('owner'), async (req: AuthenticatedRequest, res) => {
  const { email, name, role } = req.body as { email: string; name: string; role: string };
  const validRoles = ['owner', 'staff', 'read_only'];

  if (!email || !name || !validRoles.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${validRoles.join(', ')}` });
  }

  // This used to only create the database row and leave the actual Cognito
  // account to be created by hand, out of band. That gap is what let a
  // second tenant's user race an invited-but-not-yet-signed-in email: the
  // DB row (and the tenant it belonged to) existed before any Cognito
  // account did, so nothing tied the two together until whoever signed in
  // first with that email claimed it. Creating the Cognito user here, and
  // storing the `sub` it returns immediately, closes that window entirely.
  //
  // In AUTH_MODE=local there's no real user pool to create anything in —
  // stand in a random uuid as the "sub" instead, which is exactly what a
  // real cognitoSub is to the rest of this app: an opaque, immutable key.
  let cognitoSub: string;
  if (AUTH_MODE === 'local') {
    cognitoSub = crypto.randomUUID();
  } else {
    if (!COGNITO_USER_POOL_ID) {
      return res.status(500).json({ error: 'COGNITO_USER_POOL_ID is not configured' });
    }
    try {
      const result = await cognito.send(
        new AdminCreateUserCommand({
          UserPoolId: COGNITO_USER_POOL_ID,
          Username: email,
          UserAttributes: [
            { Name: 'email', Value: email },
            { Name: 'email_verified', Value: 'true' },
            { Name: 'name', Value: name },
          ],
        })
      );
      const sub = result.User?.Attributes?.find((a) => a.Name === 'sub')?.Value;
      if (!sub) {
        throw new Error('Cognito did not return a sub for the new user');
      }
      cognitoSub = sub;
    } catch (err) {
      if (err instanceof UsernameExistsException) {
        return res.status(409).json({ error: 'A Cognito user with this email already exists' });
      }
      console.error(err);
      return res.status(502).json({ error: 'Failed to create the Cognito user' });
    }
  }

  try {
    const user = await prisma.user.create({
      data: { tenantId: req.tenantId as string, email, name, role, cognitoSub },
    });
    res.status(201).json(user);
  } catch (err: any) {
    // Don't leave an orphaned Cognito user behind if the DB row couldn't be
    // created (most likely: this email already has a `users` row, so the
    // @unique on email conflicts, even though the Cognito call above
    // succeeded because that email had no Cognito account yet). Nothing to
    // roll back in local mode — cognitoSub there is just a uuid, not a
    // real Cognito user.
    if (AUTH_MODE !== 'local' && COGNITO_USER_POOL_ID) {
      try {
        await cognito.send(new AdminDeleteUserCommand({ UserPoolId: COGNITO_USER_POOL_ID, Username: email }));
      } catch (cleanupErr) {
        console.error('Failed to roll back Cognito user after DB error:', cleanupErr);
      }
    }
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

app.post('/purchase-orders/:id/approve', requireAuth, requireRole('owner', 'staff'), async (req: AuthenticatedRequest, res) => {
  try {
    const { warehouseId } = req.body as { warehouseId?: string };
    const { updateStock } = await import('./agents/tools/updateStock');
    const result = await updateStock(req.tenantId as string, req.params.id as string, warehouseId);
    res.json(result);
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to approve purchase order' });
  }
});

app.post(
  '/invoices/upload',
  requireAuth,
  requireRole('owner', 'staff'),
  upload.single('file'),
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Textract's AnalyzeExpense accepts PDF, PNG, and JPEG, but the S3
      // key used to hardcode a .pdf extension regardless of what was
      // actually uploaded. Reject anything else up front instead of
      // storing it under a lying extension and letting Textract fail on
      // it downstream.
      const MIME_EXTENSIONS: Record<string, string> = {
        'application/pdf': 'pdf',
        'image/png': 'png',
        'image/jpeg': 'jpg',
      };
      const fileExtension = MIME_EXTENSIONS[req.file.mimetype];
      if (!fileExtension) {
        return res.status(400).json({
          error: `Unsupported file type "${req.file.mimetype}". Upload a PDF, PNG, or JPEG.`,
        });
      }

      const { extractInvoice } = await import('./agents/tools/extractInvoice');
      const { findPurchaseOrderByNumber } = await import('./agents/tools/findPurchaseOrderByNumber');
      const { matchPurchaseOrder } = await import('./agents/tools/matchPurchaseOrder');

      const tenantId = req.tenantId as string;

      // Same invoice re-uploaded twice used to just re-run the match with no
      // memory of the first attempt. Hash the raw bytes and reject a repeat
      // before we spend a Textract call on it, let alone re-touch stock.
      const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
      const alreadyProcessed = await prisma.processedInvoice.findUnique({
        where: { tenantId_fileHash: { tenantId, fileHash } },
      });
      if (alreadyProcessed) {
        return res.status(409).json({
          error: 'This exact invoice file has already been uploaded for this tenant.',
          purchaseOrderId: alreadyProcessed.purchaseOrderId,
        });
      }

      // Tenant-prefixed, content-addressed key instead of
      // `uploads/{timestamp}-{originalname}`: the old key had no tenant
      // boundary in the object path and forwarded the caller's filename
      // (unsanitized) straight into S3.
      const s3Key = `invoices/${tenantId}/${crypto.randomUUID()}.${fileExtension}`;
      console.log(`[invoice-upload] received file "${req.file.originalname}" (${req.file.size} bytes), tenant=${tenantId}`);

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

      const po = await findPurchaseOrderByNumber(tenantId, invoice.poNumber);
      console.log(`[invoice-upload] found matching PO: ${po.id} (${invoice.poNumber})`);
      const result = await matchPurchaseOrder(tenantId, po.id, invoice);
      console.log(`[invoice-upload] match result: status="${result.status}" for PO ${po.id}`);

      await prisma.processedInvoice.create({
        data: { tenantId, fileHash, purchaseOrderId: po.id },
      });

      res.json({
        purchaseOrderId: po.id,
        poNumber: invoice.poNumber,
        vendorName: invoice.vendorName,
        status: result.status,
        lineResults: result.lineResults,
        extraLineItems: result.extraLineItems,
        invoiceTotalMatch: result.invoiceTotalMatch,
      });
    } catch (err: any) {
      console.error(err);
      res.status(400).json({ error: err.message || 'Failed to process invoice' });
    }
  }
);

app.listen(PORT, () => {
  console.log(`NexusRetail API listening on port ${PORT}`);
});