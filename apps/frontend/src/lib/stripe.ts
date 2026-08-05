import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-07-29.dahlia', // or the latest stable version
  appInfo: {
    name: 'Cultivators Ledger',
    version: '1.0.0',
  },
});

// Product IDs (set these after creating them in Stripe)
export const STRIPE_PRICE_GROWER_MONTHLY = process.env.STRIPE_PRICE_GROWER_MONTHLY!;

// Customer Portal settings
export const STRIPE_PORTAL_CONFIG = {
  returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
};