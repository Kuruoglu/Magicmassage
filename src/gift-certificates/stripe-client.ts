import Stripe from "stripe";

let cachedStripeClient: Stripe | undefined;
let cachedSecretKey: string | undefined;

export function getStripeClient(secretKey = process.env.STRIPE_SECRET_KEY): Stripe | undefined {
  if (!secretKey) {
    return undefined;
  }

  if (cachedStripeClient && cachedSecretKey === secretKey) {
    return cachedStripeClient;
  }

  cachedStripeClient = new Stripe(secretKey);
  cachedSecretKey = secretKey;
  return cachedStripeClient;
}
