import mongoose from "mongoose";

const verifyRole = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.email) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: User information not found in token",
        });
      }

      const db = mongoose.connection.db;
      // Better Auth কালেকশন (সাধারণত 'user' বা 'users' নামে থাকে)
      const usersCollection = db.collection("user");
      let dbUser = await usersCollection.findOne({ email: req.user.email });

      if (!dbUser) {
        dbUser = await db.collection("users").findOne({ email: req.user.email });
      }

      if (!dbUser) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: User account not found",
        });
      }

      if (dbUser.isBlocked) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: Your account has been blocked by admin",
        });
      }

      const currentRole = dbUser.role || req.user.role;

      if (!allowedRoles.includes(currentRole)) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: Requires role [${allowedRoles.join(", ")}]`,
        });
      }

      // ডাটাবেজের লেটেস্ট রোল ও তথ্য req.user এ আপডেট করা হলো
      req.user = {
        ...req.user,
        id: dbUser._id.toString(),
        role: currentRole,
        isBlocked: Boolean(dbUser.isBlocked),
      };

      next();
    } catch (error) {
      next(error);
    }
  };
};

export default verifyRole;