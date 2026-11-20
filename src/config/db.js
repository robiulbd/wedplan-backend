import mongoose from "mongoose";

// Serverless invocations reuse the same process, so cache the connection
// instead of calling mongoose.connect() on every request.
let connectionPromise = null;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(process.env.MONGODB_URI)
      .then((conn) => {
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        return conn;
      })
      .catch((error) => {
        // Allow a later invocation to retry instead of keeping a rejected
        // promise cached forever.
        connectionPromise = null;
        console.error("MongoDB connection error:", error.message);
        throw error;
      });
  }

  return connectionPromise;
};

export default connectDB;
