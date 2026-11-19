import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    serviceId: {
      type: String,
      required: [true, "Service is required"],
      index: true,
    },
    vendorId: {
      type: String,
      required: [true, "Vendor is required"],
      index: true,
    },
    customerId: {
      type: String,
      required: [true, "Customer is required"],
      index: true,
    },
    customerName: {
      type: String,
      default: "",
    },
    eventDate: {
      type: String,
      required: [true, "Event date is required"],
    },
    eventLocation: {
      type: String,
      default: "",
    },
    message: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "cancelled"],
      default: "pending",
    },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  }
);

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;
