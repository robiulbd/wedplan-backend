import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
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
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;