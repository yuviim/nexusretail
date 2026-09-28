// One-time backfill for the `sub`-based auth fix.
//
// requireAuth now looks up the caller's row by cognitoSub (Cognito's
// immutable subject claim) instead of email — email was still user-editable
// via UpdateUserAttributes, which is exactly the hole a second tenant's
// user could drive through (change your own email to one a victim tenant
// had just invited, land in their tenant on your next token).
//
// Every `users` row created before this fix has cognitoSub = NULL, and an
// un-backfilled user is simply locked out (requireAuth finds no row, not a
// silent fallback to email). Run this once, after the migration that adds
// the column and before deploying the new auth.ts, to populate it for
// everyone who already has a real Cognito account.
//
// Requires DATABASE_URL (reachable — via the bastion tunnel or however you
// normally reach the dev RDS instance from here) and real AWS credentials
// with cognito-idp:AdminGetUser on the user pool.
//
// Run: npx tsx scripts/backfill-cognito-sub.ts [--dry-run]

import { CognitoIdentityProviderClient, AdminGetUserCommand, UserNotFoundException } from '@aws-sdk/client-cognito-identity-provider';
import { prisma } from '../src/prisma';

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  if (!USER_POOL_ID) {
    console.error('COGNITO_USER_POOL_ID env var is required.');
    process.exit(1);
  }

  const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'eu-central-1' });

  const users = await prisma.user.findMany({ where: { cognitoSub: null } });
  console.log(`${users.length} user(s) need a cognitoSub backfill.`);

  let ok = 0;
  let missing = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const result = await cognito.send(
        new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: user.email })
      );
      const sub = result.UserAttributes?.find((a) => a.Name === 'sub')?.Value;

      if (!sub) {
        console.error(`  ${user.email}: Cognito returned no sub attribute — skipping, investigate manually.`);
        failed++;
        continue;
      }

      console.log(`  ${user.email} -> ${sub}${DRY_RUN ? '  (dry run, not written)' : ''}`);
      if (!DRY_RUN) {
        await prisma.user.update({ where: { id: user.id }, data: { cognitoSub: sub } });
      }
      ok++;
    } catch (err) {
      if (err instanceof UserNotFoundException) {
        // A `users` row with no matching Cognito account at all — this was
        // possible under the old flow, where POST /team only ever created
        // the database row. Needs a manual decision (create the Cognito
        // user for real, or this row is stale and should be removed), not
        // an automatic one.
        console.error(`  ${user.email}: NO COGNITO ACCOUNT EXISTS — this row predates the AdminCreateUser fix. Decide manually.`);
        missing++;
        continue;
      }
      console.error(`  ${user.email}: ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(`\nDone. ${ok} backfilled, ${missing} with no Cognito account (needs a manual decision), ${failed} failed.`);
  if (missing > 0 || failed > 0) {
    console.log('Do NOT deploy the new auth.ts until every user is accounted for — an un-backfilled user is locked out, not silently downgraded.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
