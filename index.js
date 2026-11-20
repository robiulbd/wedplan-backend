import "dotenv/config";
import express from "express";
import cors from "cors";
import connectDB from "./src/config/db.js";
import errorHandler from "./src/utils/errorHandler.js";
import authTokenRoutes from "./src/routes/authTokenRoutes.js";
import serviceRoutes from "./src/routes/serviceRoutes.js";
import bookingRoutes from "./src/routes/bookingRoutes.js";
import stripeRoutes from "./src/routes/stripeRoutes.js";

const app = express();

// Global middlewares — these MUST run before the routes so that
// req.body is populated and CORS headers are present on every response.
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);

// Stripe webhooks need the RAW request body to verify signatures, so this
// must be registered BEFORE express.json() parses the body.
app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));

app.use(express.json());

// Routes
app.use("/api/auth", authTokenRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/stripe", stripeRoutes);

// Health Check Route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "WedPlan API Server is running smoothly",
  });
});

// Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Connect Database
connectDB();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
