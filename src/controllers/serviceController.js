import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Service, { SERVICE_CATEGORIES } from "../models/Service.js";

// GET /api/services (Public: approved & active services with search, filter, sort)
export const getPublicServices = async (req, res, next) => {
  try {
    const {
      search = "",
      category = "",
      location = "",
      sort = "",
      featured = "",
      limit = "",
    } = req.query;

    const query = {
      status: "approved",
      isActive: true,
    };

    if (typeof search === "string" && search.trim() !== "") {
      query.serviceName = { $regex: search.trim(), $options: "i" };
    }

    if (
      typeof category === "string" &&
      category.trim() !== "" &&
      category !== "All"
    ) {
      query.category = category.trim();
    }

    if (typeof location === "string" && location.trim() !== "") {
      query.location = { $regex: location.trim(), $options: "i" };
    }

    let sortOption = { createdAt: -1 };
    if (sort === "price_asc") {
      sortOption = { price: 1 };
    } else if (sort === "price_desc") {
      sortOption = { price: -1 };
    }

    let dbQuery = Service.find(query).sort(sortOption);

    const parsedLimit = Number(limit);
    if (!Number.isNaN(parsedLimit) && parsedLimit > 0) {
      dbQuery = dbQuery.limit(parsedLimit);
    } else if (featured === "true") {
      dbQuery = dbQuery.limit(8);
    }

    const services = await dbQuery.lean();

    return res.status(200).json({
      success: true,
      count: services.length,
      data: services,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/services/admin/all (Admin: every service, any status)
export const getAllServicesForAdmin = async (req, res, next) => {
  try {
    const { status = "", search = "" } = req.query;

    const query = {};

    if (
      typeof status === "string" &&
      status.trim() !== "" &&
      status !== "all"
    ) {
      query.status = status.trim();
    }

    if (typeof search === "string" && search.trim() !== "") {
      const term = search.trim();
      query.$or = [
        { serviceName: { $regex: term, $options: "i" } },
        { vendorEmail: { $regex: term, $options: "i" } },
        { location: { $regex: term, $options: "i" } },
      ];
    }

    const services = await Service.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: services.length,
      data: services,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/services/:id (Public/Authenticated single service by ID)
export const getServiceById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID format",
      });
    }

    const service = await Service.findById(id).lean();
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: service,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/services/vendor/my-services (Vendor: own services)
export const getMyVendorServices = async (req, res, next) => {
  try {
    const vendorId = req.user.id;
    const services = await Service.find({ vendorId })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: services.length,
      data: services,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/services (Vendor: create new service with free plan limit check)
export const createService = async (req, res, next) => {
  try {
    const { serviceName, category, description, price, location, images } =
      req.body;

    if (
      !serviceName ||
      !category ||
      !description ||
      price === undefined ||
      !location
    ) {
      return res.status(400).json({
        success: false,
        message:
          "serviceName, category, description, price, and location are required",
      });
    }

    if (!SERVICE_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service category",
      });
    }

    const numericPrice = Number(price);
    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      return res.status(400).json({
        success: false,
        message: "Price must be a valid non-negative number",
      });
    }

    const normalizedImages = Array.isArray(images)
      ? images.filter((url) => typeof url === "string" && url.trim() !== "")
      : typeof images === "string" && images.trim() !== ""
      ? [images.trim()]
      : [];

    if (normalizedImages.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one service image is required",
      });
    }

    // ডাটাবেজ থেকে ভেন্ডরের সাবস্ক্রিপশন প্ল্যান চেক
    const db = mongoose.connection.db;
    let vendorDoc = await db
      .collection("user")
      .findOne({ email: req.user.email });
    if (!vendorDoc) {
      vendorDoc = await db
        .collection("users")
        .findOne({ email: req.user.email });
    }

    const subscriptionPlan = vendorDoc?.subscriptionPlan || "free";
    const isSubscriptionActive =
      subscriptionPlan === "premium" &&
      (!vendorDoc?.subscriptionExpiresAt ||
        new Date(vendorDoc.subscriptionExpiresAt) > new Date());

    if (!isSubscriptionActive) {
      const activeServicesCount = await Service.countDocuments({
        vendorId: req.user.id,
        isActive: true,
        status: { $ne: "rejected" },
      });

      if (activeServicesCount >= 3) {
        return res.status(403).json({
          success: false,
          message:
            "Free plan vendors can publish a maximum of 3 active services. Upgrade to Premium for unlimited services.",
        });
      }
    }

    const newService = await Service.create({
      vendorId: req.user.id,
      vendorName: vendorDoc?.name || req.user.name || "Vendor",
      vendorEmail: req.user.email,
      serviceName: serviceName.trim(),
      category,
      description: description.trim(),
      price: numericPrice,
      location: location.trim(),
      images: normalizedImages,
      status: "pending",
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: "Service submitted for admin approval",
      data: newService,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/services/:id (Vendor: update own service; Admin: update status/availability)
export const updateService = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID format",
      });
    }

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    const isOwner = service.vendorId === req.user.id;
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not have permission to modify this service",
      });
    }

    // Admin rejection is a hard delete: remove the service and any bookings
    // that reference it so no orphan records are left behind.
    if (isAdmin && req.body.status === "rejected") {
      await Booking.deleteMany({ serviceId: id });
      await service.deleteOne();

      return res.status(200).json({
        success: true,
        message: "Service rejected and permanently deleted",
      });
    }

    const {
      serviceName,
      category,
      description,
      price,
      location,
      images,
      isActive,
      status,
    } = req.body;

    if (serviceName !== undefined) service.serviceName = String(serviceName).trim();
    if (category !== undefined) {
      if (!SERVICE_CATEGORIES.includes(category)) {
        return res.status(400).json({
          success: false,
          message: "Invalid service category",
        });
      }
      service.category = category;
    }
    if (description !== undefined)
      service.description = String(description).trim();
    if (price !== undefined) {
      const numericPrice = Number(price);
      if (Number.isNaN(numericPrice) || numericPrice < 0) {
        return res.status(400).json({
          success: false,
          message: "Price must be a valid non-negative number",
        });
      }
      service.price = numericPrice;
    }
    if (location !== undefined) service.location = String(location).trim();
    if (Array.isArray(images) && images.length > 0) {
      service.images = images;
    }
    if (typeof isActive === "boolean") {
      service.isActive = isActive;
    }

    // শুধুমাত্র অ্যাডমিন সার্ভিসের approval status পরিবর্তন করতে পারে
    if (isAdmin && typeof status === "string") {
      if (!["pending", "approved", "rejected"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid service status",
        });
      }
      service.status = status;
    }

    // ভেন্ডর সার্ভিস আপডেট করলে পুনরায় অ্যাপ্রুভালের জন্য pending অবস্থায় রাখা (যদি এডমিন না হন)
    if (isOwner && !isAdmin) {
      service.status = "pending";
    }

    await service.save();

    return res.status(200).json({
      success: true,
      message: "Service updated successfully",
      data: service,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/services/:id (Owner vendor or Admin)
export const deleteService = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID format",
      });
    }

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    const isOwner = service.vendorId === req.user.id;
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You cannot delete this service",
      });
    }

    await service.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Service deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};