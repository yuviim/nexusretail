import { PrismaClient } from '@prisma/client';

// Every tool file used to do `new PrismaClient()` on its own, which opens a
// separate connection pool per module. Fine at demo traffic, wasteful and
// eventually connection-limit-breaking under load. One shared client, one
// pool, imported everywhere else.
export const prisma = new PrismaClient();
