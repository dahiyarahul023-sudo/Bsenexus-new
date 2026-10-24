/**
 * Dedicated paid-entitlement store.
 *
 * Supabase table: payment_entitlements (uid PK)
 *
 * This is deliberately separate from the ordinary users row.
 * Theme choices, notification preferences, profile edits, and app
 * republishes must never be able to create, erase, shorten, or reinterpret
 * a paid subscription. The users row receives a read-model mirror only
 * after the payment entitlement itself is durable in Supabase.
 *
 * Fail-closed contract: every read/write here uses Supabase directly and
 * throws PaymentStoreUnavailableError if Supabase cannot confirm the
 * operation. There is NO local-JSON fallback for payment entitlement.
 */
import { getSupabase } from './supabase.js';
import {
  PaymentOrderOwnershipError,
  runPaymentStore,
} from './paymentStore.js';
import {
  type PaymentOrder,
} from './paymentOrdersDao.js';
import {
  invalidateUserProfileCache,
} from './usersDao.js';
import {
  normalizePaymentEntitlement,
  type PaymentEntitlement,
} from '../services/paymentEntitlementLogic.js';

export type { PaymentEntitlement } from '../services/paymentEntitlementLogic.js';
export {
  deriveEntitlementFromOrders,
  deriveEntitlementFromProfile,
  mergePaymentEntitlementCandidates,
} from '../services/paymentEntitlementLogic.js';

const ENTITLEMENTS_TABLE = 'payment_entitlements';

function fromRow(r: any): Partial<PaymentEntitlement> {
  return {
    uid: r.uid,
    proExpiresAt: Number(r.pro_expires_at || 0),
    proPlanId: String(r.pro_plan_id || 'pro_monthly'),
    lastPaymentAt: Number(r.last_payment_at || 0),
    lastOrderId: String(r.last_order_id || ''),
    grantedOrderIds: Array.isArray(r.granted_order_ids) ? r.granted_order_ids : [],
    updatedAt: Number(r.updated_at || 0),
    source: r.source,
  };
}

export async function getPaymentEntitlement(uid: string): Promise<PaymentEntitlement | null> {
  if (!uid) return null;
  return runPaymentStore(
    'read payment entitlement',
    (async () => {
      const { data, error } = await getSupabase()
        .from(ENTITLEMENTS_TABLE)
        .select('*')
        .eq('uid', uid)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return normalizePaymentEntitlement(uid, fromRow(data));
    })(),
    10_000,
  );
}

/** Read/repair from the dedicated store and granted ledger under the same user lock
 * as purchases. Ordinary profile fields never constitute payment evidence. */
export async function reconcilePaymentEntitlement(uid: string): Promise<{
  entitlement: PaymentEntitlement | null;
  repaired: boolean;
}> {
  const entitlement = await runPaymentStore('reconcile payment entitlement', (async () => {
    const { data, error } = await getSupabase().rpc('reconcile_payment_entitlement', { p_uid: uid });
    if (error) throw error;
    return normalizePaymentEntitlement(uid, data);
  })(), 12_000);
  invalidateUserProfileCache(uid);
  return { entitlement, repaired: Boolean(entitlement) };
}

export interface AtomicPaymentGrantInput {
  orderId: string;
  uid: string;
  email: string;
  planId: string;
  validityDays: number;
  amountPaise: number;
  currency: string;
  paidAt?: number;
  grantSource: NonNullable<PaymentOrder['grantSource']>;
}

export interface AtomicPaymentGrantResult {
  proExpiresAt: number;
  alreadyGranted: boolean;
  entitlement: PaymentEntitlement;
}

/**
 * Grant Pro atomically in ONE Postgres function call:
 *   - payment_orders/<orderId> claim + granted state
 *   - payment_entitlements/<uid> durable entitlement
 *   - users/<uid> compatibility mirror
 *
 * Concurrent webhook/verify/recover/claim calls for the same order see
 * status='granted' and return the same expiry without extending twice.
 * A previous attempt left in `granting` by a crash is safely taken over.
 * If Supabase cannot commit all three writes, none is reported as done.
 * The function returns the entitlement with the app's camelCase keys, so
 * normalizePaymentEntitlement can validate it like any other source.
 */
export async function grantPaymentAtomically(
  input: AtomicPaymentGrantInput,
): Promise<AtomicPaymentGrantResult> {
  const result = await runPaymentStore(
    'grant payment entitlement',
    (async () => {
      const { data, error } = await getSupabase().rpc('grant_payment_atomic', {
        p_order_id: input.orderId,
        p_uid: input.uid,
        p_email: input.email,
        p_plan_id: input.planId,
        p_validity_days: input.validityDays,
        p_amount_paise: input.amountPaise,
        p_currency: input.currency,
        p_paid_at: input.paidAt || 0,
        p_grant_source: input.grantSource,
      });
      if (error) {
        if (String(error.message || '').includes('OWNERSHIP:')) {
          throw new PaymentOrderOwnershipError(input.orderId);
        }
        throw error;
      }
      const row = data as { pro_expires_at: number; already_granted: boolean; entitlement: any };
      const entitlement = normalizePaymentEntitlement(input.uid, row?.entitlement);
      if (!entitlement) {
        throw new Error('grant_payment_atomic returned an invalid entitlement');
      }
      return {
        proExpiresAt: Number(row.pro_expires_at || entitlement.proExpiresAt),
        alreadyGranted: !!row.already_granted,
        entitlement,
      } satisfies AtomicPaymentGrantResult;
    })(),
    15_000,
  );

  invalidateUserProfileCache(input.uid);
  return result;
}
