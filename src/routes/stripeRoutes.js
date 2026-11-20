import {
  createCheckoutSession,
  createSubscriptionSession,
  handleWebhook,
} from "../controllers/stripeController.js";
import express from "express";
import verifyRole from "../middlewares/verifyRole.js";
import verifyToken from "../middlewares/verifyToken.js";

const router = express.Router();

// Create Stripe Checkout Session
router.post("/create-checkout-session", createCheckoutSession);

// Vendor: upgrade to Premium via Stripe Checkout
router.post(
  "/create-subscription-session",
  verifyToken,
  verifyRole("vendor"),
  createSubscriptionSession,
);

// Stripe webhook endpoint
router.post("/webhook", handleWebhook);

export default router;