import { createCheckoutSession, handleWebhook } from "../controllers/stripeController.js";
import express from "express";

const router = express.Router();

// Create Stripe Checkout Session
router.post("/create-checkout-session", createCheckoutSession);

// Stripe webhook endpoint
router.post("/webhook", handleWebhook);

export default router;