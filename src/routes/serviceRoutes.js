import express from "express";
import {
  createService,
  deleteService,
  getAllServicesForAdmin,
  getMyVendorServices,
  getPublicServices,
  getServiceById,
  updateService,
} from "../controllers/serviceController.js";
import verifyToken from "../middlewares/verifyToken.js";
import verifyRole from "../middlewares/verifyRole.js";

const router = express.Router();

// Public routes
router.get("/", getPublicServices);

// Admin private routes
router.get(
  "/admin/all",
  verifyToken,
  verifyRole("admin"),
  getAllServicesForAdmin
);

// Vendor private routes
router.get(
  "/vendor/my-services",
  verifyToken,
  verifyRole("vendor"),
  getMyVendorServices
);

router.post("/", verifyToken, verifyRole("vendor"), createService);

// Single service fetch (Public or authenticated)
router.get("/:id", getServiceById);

// Update & Delete (Vendor owner or Admin)
router.patch(
  "/:id",
  verifyToken,
  verifyRole("vendor", "admin"),
  updateService
);
router.delete(
  "/:id",
  verifyToken,
  verifyRole("vendor", "admin"),
  deleteService
);

export default router;