const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect("mongodb+srv://bhavyac888_db_user:abcd@cluster0.d3tbrad.mongodb.net/ecommerce?appName=Cluster0");  
    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.error("MongoDB Connection Failed:", err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
