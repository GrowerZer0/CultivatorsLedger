import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not defined');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-08-26.dahlia',
});

// Export configuration for stripe actions
export const STRIPE_PRICE_GROWER_MONTHLY = process.env.STRIPE_PRICE_GROWER_MONTHLY || '';
export const STRIPE_PORTAL_CONFIG = {
  return_url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000/dashboard',
};

export default stripe;
