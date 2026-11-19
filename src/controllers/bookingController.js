import mongoose from "mongoose";
import Service from "../models/Service.js";
import Booking from "../models/Booking.js";

// POST /api/bookings — Customer submits a booking request for a service.
export const createBooking = async (req, res, next) => {
  try {
    const { serviceId, eventDate, eventLocation, message } = req.body;

    if (!serviceId) {
      return res
        .status(400)
        .json({ success: false, message: "Service is required" });
    }

    if (!eventDate) {
      return res
        .status(400)
        .json({ success: false, message: "Event date is required" });
    }

    const service = await Service.findById(serviceId).lean();
    if (!service) {
      return res
        .status(404)
        .json({ success: false, message: "Service not found" });
    }

    if (service.status !== "approved" || service.isActive !== true) {
      return res.status(400).json({
        success: false,
        message: "This service is not available for booking",
      });
    }

    if (service.vendorId === req.user.id) {
      return res
        .status(400)
        .json({ success: false, message: "Vendors cannot book their own services" });
    }

    if (req.user.role === "admin") {
      return res
        .status(400)
        .json({ success: false, message: "Admins cannot submit customer booking requests" });
    }

    const duplicate = await Booking.findOne({
      serviceId,
      vendorId: service.vendorId,
      customerId: req.user.id,
      eventDate,
      status: { $in: ["pending", "accepted"] },
    }).lean();

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message:
          "You already have an active booking request for this service on the same event date",
      });
    }

    const booking = await Booking.create({
      serviceId,
      vendorId: service.vendorId,
      customerId: req.user.id,
      customerName: req.user.name || req.user.email || "Customer",
      eventDate,
      eventLocation: eventLocation || "",
      message: message || "",
      status: "pending",
    });

    return res.status(201).json({
      success: true,
      message: "Booking request sent successfully",
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/bookings/customer/mine — Customer: own booking requests
export const getCustomerBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ customerId: req.user.id })
      .sort({ createdAt: -1 })
      .lean();

    const serviceIds = [...new Set(bookings.map((b) => b.serviceId).filter(Boolean))];
    const services = await Service.find({ _id: { $in: serviceIds } }).lean();
    const serviceMap = Object.fromEntries(
      services.map((s) => [String(s._id), s])
    );

    const data = bookings.map((booking) => ({
      ...booking,
      service: serviceMap[booking.serviceId] || null,
    }));

    return res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

// GET /api/bookings/vendor/mine — Vendor: booking requests for own services
export const getVendorBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ vendorId: req.user.id })
      .sort({ createdAt: -1 })
      .lean();

    const serviceIds = [...new Set(bookings.map((b) => b.serviceId).filter(Boolean))];
    const services = await Service.find({ _id: { $in: serviceIds } }).lean();
    const serviceMap = Object.fromEntries(
      services.map((s) => [String(s._id), s])
    );

    const data = bookings.map((booking) => ({
      ...booking,
      service: serviceMap[booking.serviceId] || null,
    }));

    return res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/bookings/:id/accept — Vendor accepts a pending booking
export const acceptBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (booking.vendorId !== req.user.id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    if (booking.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending booking requests can be accepted or rejected",
      });
    }

    booking.status = "accepted";
    await booking.save();

    return res.status(200).json({ success: true, message: "Booking accepted", data: booking });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/bookings/:id/reject — Vendor rejects a pending booking
export const rejectBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (booking.vendorId !== req.user.id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    if (booking.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending booking requests can be accepted or rejected",
      });
    }

    booking.status = "rejected";
    await booking.save();

    return res.status(200).json({ success: true, message: "Booking rejected", data: booking });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/bookings/:id/cancel — Customer cancels a pending booking
export const cancelBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (booking.customerId !== req.user.id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    if (booking.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending booking requests can be cancelled",
      });
    }

    booking.status = "cancelled";
    await booking.save();

    return res.status(200).json({ success: true, message: "Booking cancelled", data: booking });
  } catch (error) {
    next(error);
  }
};

export default {
  createBooking,
  getCustomerBookings,
  getVendorBookings,
  acceptBooking,
  rejectBooking,
  cancelBooking,
};
