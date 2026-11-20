import stripe from "../config/stripe.js";

// CREATE /api/stripe/create-checkout-session
// Body: { priceInCents, customerEmail, customerName, serviceId, successUrl, cancelUrl }
export async function createCheckoutSession(req, res, next) {
  try {
    const {
      priceInCents,
      customerEmail,
      customerName,
      serviceId,
      successUrl,
      cancelUrl,
    } = req.body || {};

    if (!priceInCents || Number(priceInCents) <= 0) {
      return res.status(400).json({ error: "Invalid price" });
    }

    const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: Math.round(Number(priceInCents)),
            product_data: {
              name: `WedPlan Booking - ${serviceId || "Purchase"}`,
              description: "Wedding service booking payment",
            },
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      ...(customerEmail && { customer_email: customerEmail }),
      success_url:
        successUrl ||
        `${clientUrl}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${clientUrl}/payments/cancel`,
      metadata: {
        serviceId: serviceId || "",
      },
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error("❌ createCheckoutSession error:", error.message);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
}

// POST /api/stripe/webhook
// NOTE: this route is mounted with express.raw() in index.js so that
// req.body is a Buffer — Stripe signature verification needs the raw payload.
export async function handleWebhook(req, res) {
  const sig = req.headers["stripe-signature"];

  if (!sig) {
    return res.status(400).send("Webhook Error: missing stripe-signature header");
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("⚠️  Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        console.log(`✅ Checkout session completed: ${session.id}`);
        console.log(`   Amount total: ${session.amount_total}`);
        console.log(`   Service ID: ${session.metadata?.serviceId || "n/a"}`);
        // TODO: mark the booking/transaction as paid in MongoDB
        break;
      }
      case "checkout.session.expired": {
        const session = event.data.object;
        console.log(`❌ Checkout session expired: ${session.id}`);
        break;
      }
      default:
        console.log(`🔸 Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error("❌ Webhook handler error:", error.message);
    res.status(500).json({ error: "Webhook handler failed" });
  }
}

export default { createCheckoutSession, handleWebhook };
