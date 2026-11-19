import express from "express";
import {
  acceptBooking,
  cancelBooking,
  createBooking,
  getCustomerBookings,
  getVendorBookings,
  rejectBooking,
} from "../controllers/bookingController.js";
import verifyToken from "../middlewares/verifyToken.js";
import verifyRole from "../middlewares/verifyRole.js";

const router = express.Router();

// Customer submits a booking request
router.post("/", verifyToken, verifyRole("customer"), createBooking);

// Customer: own booking requests
router.get(
  "/customer/mine",
  verifyToken,
  verifyRole("customer"),
  getCustomerBookings
);

// Vendor: booking requests for own services
router.get(
  "/vendor/mine",
  verifyToken,
  verifyRole("vendor"),
  getVendorBookings
);

// Vendor: accept / reject pending booking requests
router.patch(
  "/:id/accept",
  verifyToken,
  verifyRole("vendor"),
  acceptBooking
);
router.patch(
  "/:id/reject",
  verifyToken,
  verifyRole("vendor"),
  rejectBooking
);

// Customer: cancel a pending booking request
router.patch(
  "/:id/cancel",
  verifyToken,
  verifyRole("customer"),
  cancelBooking
);

export default router;
