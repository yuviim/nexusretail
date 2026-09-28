import { z, ZodType } from 'zod';
import { Request, Response, NextFunction } from 'express';

// Nothing coming in over req.body was validated before it reached Prisma —
// a negative order quantity was accepted as-is, a non-integer quantity
// blew up as an unhandled 500 inside Prisma's Decimal handling instead of
// a clean 400, and duplicate product IDs in one order's items produced a
// misleading "One or more products not found" (the product WAS found,
// just requested twice, which the old length-mismatch check couldn't
// distinguish from a genuinely missing product).
export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    // Replaced, not merged — z.parse() applies defaults (e.g.
    // reorderPoint's 0) and drops anything not in the schema, so every
    // route handler downstream can trust req.body matches its schema
    // exactly instead of re-checking or re-defaulting fields itself.
    req.body = result.data;
    next();
  };
}

// A decimal string like "9.40", matching how unitPrice is actually stored
// (Prisma's Decimal type) and passed around this codebase — not a number,
// which would reintroduce float rounding into money.
const decimalString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'must be a decimal string like "9.40", up to 2 decimal places');

export const localLoginSchema = z.object({
  email: z.string().email(),
});

export const createProductSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  unitPrice: decimalString,
  reorderPoint: z.number().int().nonnegative().default(0),
  warehouseId: z.string().uuid(),
  initialQuantity: z.number().int().nonnegative().default(0),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  unitPrice: decimalString.optional(),
  reorderPoint: z.number().int().nonnegative().optional(),
});

export const updateStockSchema = z.object({
  warehouseId: z.string().uuid(),
  quantityOnHand: z.number().int().nonnegative(),
});

export const createOrderSchema = z
  .object({
    customerId: z.string().uuid(),
    items: z
      .array(
        z.object({
          productId: z.string().uuid(),
          quantity: z.number().int().positive(),
        })
      )
      .min(1),
  })
  .refine((data) => new Set(data.items.map((i) => i.productId)).size === data.items.length, {
    message: 'Duplicate productId in items — combine into a single line with the total quantity instead',
    path: ['items'],
  });

export const updateOrderStatusSchema = z.object({
  status: z.enum(['placed', 'stock_reserved', 'payment', 'fulfilled']),
});

export const createTeamMemberSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['owner', 'staff', 'read_only']),
});

export const approvePurchaseOrderSchema = z.object({
  warehouseId: z.string().uuid().optional(),
});
