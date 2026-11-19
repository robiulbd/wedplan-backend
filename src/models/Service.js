import mongoose from "mongoose";

export const SERVICE_CATEGORIES = [
  "Photography & Videography",
  "Wedding Venues",
  "Decoration & Florist",
  "Catering Services",
  "Makeup & Styling",
  "Wedding Fashion",
];

const serviceSchema = new mongoose.Schema(
  {
    vendorId: {
      type: String,
      required: [true, "Vendor ID is required"],
      index: true,
    },
    vendorName: {
      type: String,
      default: "",
    },
    vendorEmail: {
      type: String,
      default: "",
    },
    serviceName: {
      type: String,
      required: [true, "Service name is required"],
      trim: true,
    },
    category: {
      type: String,
      required: [true, "Service category is required"],
      enum: SERVICE_CATEGORIES,
    },
    description: {
      type: String,
      required: [true, "Service description is required"],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    location: {
      type: String,
      required: [true, "Location is required"],
      trim: true,
    },
    images: {
      type: [String],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "At least one service image URL is required",
      },
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  }
);

const Service = mongoose.model("Service", serviceSchema);

export default Service;