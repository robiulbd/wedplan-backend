import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const router = express.Router();

// ইউজার লগইন/সেশন নিশ্চিত হওয়ার পর ব্যাকএন্ডের জন্য JWT টোকেন ইস্যু করা
router.post("/jwt", async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required to generate token",
      });
    }

    const db = mongoose.connection.db;
    let user = await db.collection("user").findOne({ email });
    if (!user) {
      user = await db.collection("users").findOne({ email });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Your account is blocked",
      });
    }

    const payload = {
      id: user._id.toString(),
      email: user.email,
      role: user.role || "customer",
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
        role: user.role || "customer",
        subscriptionPlan: user.subscriptionPlan || "free",
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;