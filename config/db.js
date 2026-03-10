const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27018/my_drops?replicaSet=rs0");  
    //  const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log("Mongo Connected:", mongoose.connection.host, mongoose.connection.port, mongoose.connection.name);
    console.log("MongoDB Connected");
  } catch (err) {
    console.error("MongoDB Connection Failed:", err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
