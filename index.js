require('dotenv').config(); // Load .env variables

const express = require("express");
const bodyParser = require("body-parser");
const connectDB = require("./config/db");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const passport = require("passport");
const cron = require("node-cron");
const cors = require("cors");
const User = require("./models/User");
const Drop = require("./models/FruitDrop");
const { startAutomation, generateDailyDeals, generateFreshDrop } = require("./utils/automationEngine");
// const Product = require("./models/Product");

// ------------------ ROUTES ------------------
const authRoutes = require("./routes/authRoutes");
const membershipRoutes = require("./routes/membershipRoutes");
const dropRoutes = require("./routes/dropRoutes");
const adminAuthRoutes = require("./routes/admin/authRoutes");
const adminDropRoutes = require("./routes/admin/adminDropRoutes");
const adminDealRoutes = require("./routes/admin/adminDealRoutes");
const adminAnalyticsRoutes = require("./routes/admin/adminAnalyticsRoutes");
const dealRoutes = require("./routes/dealRoutes");
const normalDealRoutes = require("./routes/normalDealRoutes");
const googleAuthRoutes = require("./routes/googleRoutes");
const adminNormalDealRoutes = require("./routes/admin/adminNormalDealRoutes");
const adminMultiDealRoutes = require("./routes/admin/adminmultiDealController");
const adminSingleDealRoutes = require("./routes/admin/adminSingleDealRoute");
const adminSellerRoutes = require("./routes/admin/adminSellerRoutes");
const sellerAuthRoutes = require("./routes/seller/sellerAuthRoutes");
const sellerRoutes = require("./routes/seller/sellerRoutes");
const cartRoutes= require("./routes/cartRoutes");
const orderRoutes=require("./routes/orderRoutes");
const seller=require("./routes/seller/seller");
const orderHistoryRoutes = require("./routes/orderHistoryRoutes");
const apiRoutes = require("./routes/Api/api_routes");
const app = express(); 

// ------------------ CONNECT DATABASE ------------------
connectDB();
app.use(cors({
  origin: "http://localhost:5173", // Tera Frontend URL
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true // Agar cookies/headers use kar raha hai toh zaruri hai
}));
startAutomation(); // Start the automation engine
generateDailyDeals();
generateFreshDrop();
// ------------------ VIEW ENGINE ------------------
app.set("view engine", "ejs");
app.set("views", __dirname + "/views");

// ------------------ MIDDLEWARE ------------------
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

// ------------------ ROUTES (without /api prefix) ------------------
app.use("/uploads", express.static("uploads"));
app.use("/auth", authRoutes);
app.use("/membership", membershipRoutes);
app.use("/drops", dropRoutes);

app.use("/admin", adminAuthRoutes);
app.use("/admin/drops", adminDropRoutes);
app.use("/admin/deals", adminDealRoutes);
app.use("/admin", adminAnalyticsRoutes);
app.use("/deals", dealRoutes);
app.use("/auth/google", googleAuthRoutes);
app.use("/normal-deals", normalDealRoutes);
app.use("/admin/normal-deals", adminNormalDealRoutes);
app.use("/admin/multi-deals", adminMultiDealRoutes);
app.use("/admin/single-deals", adminSingleDealRoutes);
app.use("/seller/auth", sellerAuthRoutes);
app.use("/seller", sellerRoutes);
app.use("/admin/sellers", adminSellerRoutes);
app.use("/cart", cartRoutes);
app.use("/order", orderRoutes);
app.use("/sellers", seller);
app.use("/orders", orderHistoryRoutes); 
app.use("/compare", require("./routes/compareNormalDealRoutes"));
app.use("/analytics", require("./routes/analyticsExpense"));
app.use("/qa", require("./routes/productQARoutes"));
app.use("/group", require("./routes/groupRoutes"));
// app.use("/razorpay", require("./routes/razorpayRoutes"));
app.use("/wallet", require("./routes/walletRoutes"));



// Mount all routes under /api
app.use("/api", apiRoutes);
// ------------------ HOME ROUTES ------------------
app.get("/", (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect("/drops");
  }
  res.render("auth/login");
});

app.get("/admin", (req, res) => res.redirect("/admin/login"));

// ------------------ CRON JOB ------------------
cron.schedule("* * * * *", async () => {
  try {
    console.log("Running cron job to delete expired drops...");
    const now = new Date();
    const result = await Drop.deleteMany({ endTime: { $lte: now } });
    if (result.deletedCount > 0) {
      console.log(`Deleted ${result.deletedCount} expired drops`);
    }
  } catch (err) {
    console.error("Error deleting expired drops:", err);
  }
});

// ------------------ START SERVER ------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => 
 
  console.log(`Server running on port ${PORT}`));
