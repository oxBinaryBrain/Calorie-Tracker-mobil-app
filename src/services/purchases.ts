import { Platform } from 'react-native';
import type PurchasesType from 'react-native-purchases';
import type { PurchasesPackage } from 'react-native-purchases';

const RC_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
const RC_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
const ENTITLEMENT_ID = process.env.EXPO_PUBLIC_ENTITLEMENT_ID || 'pro';

export type PlanId = 'free' | 'pro_monthly' | 'pro_yearly';

export type PlanOption = {
  id: PlanId;
  title: string;
  priceLabel: string;
  periodLabel: string;
  description: string;
};

export const FALLBACK_PLANS: PlanOption[] = [
  {
    id: 'free',
    title: 'Free',
    priceLabel: '$0',
    periodLabel: 'forever',
    description: 'Log meals and movement, daily targets, water, weight and sleep.',
  },
  {
    id: 'pro_monthly',
    title: 'Pro Monthly',
    priceLabel: '$4.99',
    periodLabel: 'per month',
    description: 'Photo logging, weekly summaries, unlimited history.',
  },
  {
    id: 'pro_yearly',
    title: 'Pro Yearly',
    priceLabel: '$39.99',
    periodLabel: 'per year · save 33%',
    description: 'Everything in Pro Monthly, billed once a year.',
  },
];

let initialized = false;

export function isRevenueCatConfigured(): boolean {
  return Boolean(RC_IOS_KEY || RC_ANDROID_KEY);
}

async function getPurchases(): Promise<typeof PurchasesType | null> {
  try {
    const mod = await import('react-native-purchases');
    const Purchases = mod.default ?? (mod as unknown as typeof PurchasesType);
    if (!Purchases || typeof Purchases.configure !== 'function') return null;
    return Purchases;
  } catch {
    return null; // native module unavailable (Expo Go)
  }
}

export async function initPurchases(): Promise<void> {
  if (initialized) return;
  const apiKey = Platform.OS === 'ios' ? RC_IOS_KEY : RC_ANDROID_KEY;
  if (!apiKey) return;
  const Purchases = await getPurchases();
  if (!Purchases) return;
  try {
    Purchases.configure({ apiKey });
    initialized = true;
  } catch {
    // already configured or store unavailable — stay calm, fall back
  }
}

async function currentEntitlementActive(): Promise<boolean> {
  if (!initialized) return false;
  const Purchases = await getPurchases();
  if (!Purchases) return false;
  try {
    const customer = await Purchases.getCustomerInfo();
    return Boolean(customer.entitlements.active[ENTITLEMENT_ID]);
  } catch {
    return false;
  }
}

async function offerings(): Promise<PurchasesPackage[]> {
  if (!initialized) return [];
  const Purchases = await getPurchases();
  if (!Purchases) return [];
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages ?? [];
  } catch {
    return [];
  }
}

function labelForPkg(pkg: PurchasesPackage): { title: string; periodLabel: string } {
  const p = pkg.product;
  if (pkg.packageType === 'ANNUAL') return { title: 'Pro Yearly', periodLabel: 'per year' };
  if (pkg.packageType === 'MONTHLY') return { title: 'Pro Monthly', periodLabel: 'per month' };
  return { title: p.title || 'Pro', periodLabel: '' };
}

/** Unified plan list: real StoreKit/Play offerings when configured, else fallback. */
export async function getPlans(): Promise<{ plans: PlanOption[]; simulated: boolean }> {
  const pkgs = await offerings();
  if (pkgs.length === 0) return { plans: FALLBACK_PLANS, simulated: true };
  const plans: PlanOption[] = [
    FALLBACK_PLANS[0],
    ...pkgs.map((pkg) => {
      const { title, periodLabel } = labelForPkg(pkg);
      return {
        id: (pkg.packageType === 'ANNUAL' ? 'pro_yearly' : 'pro_monthly') as PlanId,
        title,
        priceLabel: pkg.product.priceString,
        periodLabel,
        description: pkg.product.description || FALLBACK_PLANS[1].description,
      };
    }),
  ];
  return { plans, simulated: false };
}

export async function purchase(planId: PlanId): Promise<boolean> {
  if (planId === 'free') {
    await cancelSimulatedPro();
    return true;
  }
  if (!initialized) {
    // Simulated purchase — persists locally via the caller (zustand store).
    return true;
  }
  const Purchases = await getPurchases();
  if (!Purchases) return false;
  const pkgs = await offerings();
  const pkg = pkgs.find((p) => (p.packageType === 'ANNUAL' ? 'pro_yearly' : 'pro_monthly') === planId);
  if (!pkg) return false;
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return Boolean(customerInfo.entitlements.active[ENTITLEMENT_ID]);
  } catch {
    return false; // user cancelled or store error
  }
}

export async function restore(): Promise<boolean> {
  if (!initialized) return false;
  const Purchases = await getPurchases();
  if (!Purchases) return false;
  try {
    const customer = await Purchases.restorePurchases();
    return Boolean(customer.entitlements.active[ENTITLEMENT_ID]);
  } catch {
    return false;
  }
}

export async function checkPro(): Promise<boolean> {
  return currentEntitlementActive();
}

export async function cancelSimulatedPro(): Promise<void> {
  // no-op placeholder; simulated state lives in the zustand prefs store
}
