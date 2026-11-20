import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import verifyRole from "../middlewares/verifyRole.js";
import verifyToken from "../middlewares/verifyToken.js";

const router = express.Router();

const ALLOWED_PUBLIC_ROLES = new Set(["customer", "vendor"]);

async function findUserByEmail(email) {
  if (!mongoose.connection.db) {
    throw new Error("Database connection is not ready");
  }

  const db = mongoose.connection.db;
  const userDoc = await db.collection("user").findOne({ email });
  if (userDoc) {
    return { collectionName: "user", user: userDoc };
  }

  const usersDoc = await db.collection("users").findOne({ email });
  if (usersDoc) {
    return { collectionName: "users", user: usersDoc };
  }

  return null;
}

// ইউজার লগইন/সেশন নিশ্চিত হওয়ার পর ব্যাকএন্ডের জন্য JWT টোকেন ইস্যু করা
router.post("/jwt", async (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "JWT_SECRET is not configured on the server",
      });
    }

    const rawEmail = req.body?.email;
    const requestedRole = req.body?.role;

    if (!rawEmail || typeof rawEmail !== "string") {
      return res.status(400).json({
        success: false,
        message: "Valid email is required to generate token",
      });
    }

    const normalizedEmail = rawEmail.trim().toLowerCase();
    const found = await findUserByEmail(normalizedEmail);

    if (!found) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const { collectionName, user } = found;

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Your account is blocked",
      });
    }

    // ইউজারের বিদ্যমান রোল না থাকলে এবং নিরাপদ পাবলিক রোল (customer/vendor) এলে তা সেট করা (admin কখনোই নয়)
    let resolvedRole = user.role;
    if (!resolvedRole) {
      resolvedRole =
        typeof requestedRole === "string" && ALLOWED_PUBLIC_ROLES.has(requestedRole)
          ? requestedRole
          : "customer";

      await mongoose.connection.db
        .collection(collectionName)
        .updateOne(
          { _id: user._id },
          {
            $set: {
              role: resolvedRole,
              isBlocked: Boolean(user.isBlocked),
              subscriptionPlan: user.subscriptionPlan || "free",
            },
          }
        );
    }

    const payload = {
      id: user._id.toString(),
      email: user.email,
      role: resolvedRole,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        image: user.image || "",
        role: resolvedRole,
        subscriptionPlan: user.subscriptionPlan || "free",
      },
    });
  } catch (error) {
    next(error);
  }
});

// বর্তমান লগইন করা ইউজারের ডাটা (role, plan ইত্যাদি) ফেরত দেয়
router.get("/me", verifyToken, async (req, res, next) => {
  try {
    const normalizedEmail =
      typeof req.user?.email === "string"
        ? req.user.email.trim().toLowerCase()
        : "";

    if (!normalizedEmail) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Token does not contain a valid email",
      });
    }

    const found = await findUserByEmail(normalizedEmail);
    if (!found) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const { user } = found;

    return res.status(200).json({
      success: true,
      data: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        image: user.image || "",
        role: user.role || "customer",
        isBlocked: Boolean(user.isBlocked),
        subscriptionPlan: user.subscriptionPlan || "free",
        subscriptionExpiresAt: user.subscriptionExpiresAt || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Admin: list all registered users (optionally filtered by role)
router.get("/users", verifyToken, verifyRole("admin"), async (req, res, next) => {
  try {
    if (!mongoose.connection.db) {
      return res.status(500).json({ success: false, message: "Database not ready" });
    }
    const roleFilter =
      typeof req.query.role === "string" ? req.query.role.trim() : "";
    const query = {};
    if (roleFilter) query.role = roleFilter;

    const users = await mongoose.connection.db
      .collection("user")
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    const data = users.map((u) => ({
      id: u._id.toString(),
      name: u.name || "",
      email: u.email || "",
      role: u.role || "customer",
      isBlocked: Boolean(u.isBlocked),
      subscriptionPlan: u.subscriptionPlan || "free",
      createdAt: u.createdAt || null,
    }));

    return res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
});

// Helper to locate a user document in either collection name
async function findUserById(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const objectId = new mongoose.Types.ObjectId(id);
  const db = mongoose.connection.db;
  let doc = await db.collection("user").findOne({ _id: objectId });
  if (doc) return { collectionName: "user", user: doc };
  doc = await db.collection("users").findOne({ _id: objectId });
  if (doc) return { collectionName: "users", user: doc };
  return null;
}

// Admin: block or unblock a user
router.patch("/users/:id/block", verifyToken, verifyRole("admin"), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isBlocked } = req.body || {};
    if (typeof isBlocked !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isBlocked must be a boolean",
      });
    }

    const found = await findUserById(id);
    if (!found) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (found.user._id.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot block or unblock your own account",
      });
    }

    await mongoose.connection.db
      .collection(found.collectionName)
      .updateOne({ _id: found.user._id }, { $set: { isBlocked, updatedAt: new Date() } });

    return res.status(200).json({
      success: true,
      message: isBlocked ? "User blocked" : "User unblocked",
    });
  } catch (error) {
    next(error);
  }
});

// Admin: permanently delete a user and their related data
router.delete("/users/:id", verifyToken, verifyRole("admin"), async (req, res, next) => {
  try {
    const { id } = req.params;
    const found = await findUserById(id);
    if (!found) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (found.user._id.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    const db = mongoose.connection.db;
    const userId = found.user._id.toString();
    const userRole = found.user.role;

    // Cascade delete related records
    await db.collection("account").deleteMany({ userId: found.user._id });
    await db.collection("session").deleteMany({ userId: found.user._id });
    if (userRole === "vendor") {
      const services = await db
        .collection("services")
        .find({ vendorId: userId })
        .toArray();
      const serviceIds = services.map((s) => s._id.toString());
      await db.collection("services").deleteMany({ vendorId: userId });
      if (serviceIds.length) {
        await db.collection("bookings").deleteMany({
          serviceId: { $in: serviceIds },
        });
      }
    }
    await db.collection("bookings").deleteMany({ customerId: userId });

    await db.collection(found.collectionName).deleteOne({ _id: found.user._id });

    return res.status(200).json({
      success: true,
      message: "User and related data deleted permanently",
    });
  } catch (error) {
    next(error);
  }
});

export default router;