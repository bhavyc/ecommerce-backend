require('dotenv').config(); // Load .env variables
const Order = require("./models/Order");
const Inventory = require("./models/Inventory");
const express = require("express");
const bodyParser = require("body-parser");
const connectDB = require("./config/db");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const passport = require("passport");
const cron = require("node-cron");
const cors = require("cors");
const User = require("./models/User");
const Transaction = require("./models/Transaction");
const PayoutRequest = require("./models/PayoutRequest"); 
const Drop = require("./models/FruitDrop");
const { startAutomation, generateDailyDeals, generateDailyDrop } = require("./utils/automationEngine");
const adminTransactionRoutes = require("./routes/admin/adminTransactionRoutes"); 
 const mongoose = require('mongoose');
// index.js ya app.js mein top par add kar
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");









// ------------------ ROUTES IMPORT ------------------
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
const adminPayoutRoutes = require("./routes/admin/adminPayoutRoutes");
const sellerPayoutRoutes = require("./routes/seller/sellerPayoutRoutes"); 
const adminOrderRoutes = require("./routes/admin/adminOrderRoutes");
 
const app = express(); 




// 1. Security Headers
// app.use(helmet()); 

// 2. NoSQL Injection se bachao (Malicious queries rokne ke liye)

// 3. Rate Limiter: Ek IP se 15 min mein sirf 100 requests (DDoS protection)
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 100,
//   message: "Too many requests, please try again later."
// });
// app.use("/api/", limiter);

// 4. Maintenance: Har raat 3 baje User model se purana 'seenDrops' data saaf karo
 

// ------------------ CONNECT DATABASE & START AUTOMATION ------------------
// FIX: Wait for DB connection before running generators
connectDB().then(async () => {
  console.log("Database Connected. Initializing Automation Flow...");
  
  startAutomation(); // Start cron schedules
  
  // Pehle check karega ki Paid Slots hain ya nahi, fir Deals/Drops banayega
  await generateDailyDeals(); 
  await generateDailyDrop();
  
  console.log("Server Setup Complete: Deals & Drops Synced.");
}).catch(err => {
  console.error("Database connection failed:", err);
});

app.use(cors({
  origin: "http://localhost:3000", 
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true 
}));

// ------------------ VIEW ENGINE ------------------
app.set("view engine", "ejs");
app.set("views", __dirname + "/views");

// ------------------ MIDDLEWARE ------------------
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// app.use(mongoSanitize());

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

// ------------------ ROUTES ------------------
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
app.use("/wallet", require("./routes/walletRoutes"));
app.use("/seller", require("./routes//seller/sellerSlotRoutes"));
app.use("/admin/payouts", adminPayoutRoutes);
app.use("/seller/payouts", sellerPayoutRoutes); 
app.use("/admin/orders", adminOrderRoutes);
app.use("/admin/transactions", adminTransactionRoutes);
 
// Mount API routes
app.use("/api", apiRoutes);

// ------------------ HOME ROUTES ------------------
app.get("/", (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect("/drops");
  }
  res.render("auth/login");
});

app.get("/admin", (req, res) => res.redirect("/admin/login"));
 
app.get("/delivery/confirm/:orderId", (req, res) => {
    res.render("delivery/confirm", { orderId: req.params.orderId });
});

app.get("/delivery/verify-return/:orderId", (req, res) => {
    // Ye 'verifyPickup'   views/delivery/verifyPickup.ejs file  
    res.render("delivery/verifyPickup", { orderId: req.params.orderId });
});
// ------------------ CRON JOBS ------------------

// 1. Cleanup expired drops
cron.schedule("* * * * *", async () => {
  try {
    const now = new Date();
    const result = await Drop.deleteMany({ endTime: { $lte: now } });
    if (result.deletedCount > 0) {
      console.log(`Deleted ${result.deletedCount} expired drops`);
    }
  } catch (err) {
    console.error("Error deleting expired drops:", err);
  }
});

const { syncPendingOrders } = require('./controllers/Api/orderControllerApi');

// 2. Hourly Payment Sync
cron.schedule('0 * * * *', async () => {
  console.log('Running Hourly Payment Sync Job...');
  await syncPendingOrders(null, null); 
});


// AUTO-DELIVERY CONFIRMATION JOB (Har raat 2 baje chalegi)
cron.schedule('0 2 * * *', async () => {
    console.log("Checking for orders that need Auto-Confirmation...");
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const ordersToAutoConfirm = await Order.find({
            orderStatus: "Shipped",
            "deliveryDetails.deliveryMethod": "COURIER",
            "deliveryDetails.dispatchedAt": { $lte: sevenDaysAgo }
        });

        for (const order of ordersToAutoConfirm) {
            // Logic to mark as Delivered
            order.orderStatus = "Delivered";
            order.deliveryDetails.deliveredAt = new Date();
            await order.save();

            // 15 din ka payout timer shuru karo (Same as manual confirmation)
            const releaseDate = new Date();
            releaseDate.setDate(releaseDate.getDate() + 15);

            await Transaction.updateMany(
                { orderId: order._id, type: "CREDIT" },
                { status: "ON_HOLD", releaseDate: releaseDate }
            );
            
            console.log(`Auto-Confirmed Order #${order._id.toString().slice(-6)}`);
        }
    } catch (err) {
        console.error("Auto-Confirm Job Error:", err);
    }
});


cron.schedule('0 3 * * *', async () => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await User.updateMany({}, { $pull: { seenDrops: { seenAt: { $lt: yesterday } } } });
  console.log("Cleanup: Purane seenDrops delete ho gaye.");
});



// 3. Daily Seller Payment Release
cron.schedule('0 0 * * *', async () => {
  console.log('Running Seller Payment Release Job...');
  try {
    const now = new Date();
    const transactionsToRelease = await Transaction.find({
      status: "ON_HOLD",
      releaseDate: { $lte: now } 
    });

    for (const txn of transactionsToRelease) {
      const seller = await User.findById(txn.user);
      if (seller && seller.pendingBalance >= txn.amount) {
           seller.pendingBalance -= txn.amount;
           seller.walletBalance += txn.amount;
           await seller.save();

           txn.status = "SUCCESS";
           txn.description = txn.description.replace("Funds on Hold", "Funds Released");
           await txn.save();
           console.log(`Released ${txn.amount} to Seller ${seller.name}`);
      }
    }
  } catch (err) {
    console.error("Release Job Error:", err);
  }
});




cron.schedule('*/5 * * * *', async () => { // Runs every 5 minutes
    console.log("Checking for expired stock reservations...");
    const session = await mongoose.startSession();
    session.startTransaction();


    try {
        const now = new Date();
        // Find orders that:
        // 1. Are Online
        // 2. Haven't paid yet
        // 3. Have reserved stock
        // 4. Have expired reservations
        const expiredOrders = await Order.find({
            paymentMethod: "ONLINE",
            paymentStatus: "PENDING",
            isStockReserved: true,
            reservationExpiry: { $lte: now }
        }).session(session);

        for (const order of expiredOrders) {
            for (const item of order.items) {
                // Logic to find actual product ID (same as reservation logic)
                // ... find actualProductId ...

                // RESTORE STOCK
                await Inventory.findOneAndUpdate(
                    { product: actualProductId, seller: item.seller },
                    { $inc: { remaining: item.quantity, sold: -item.quantity } },
                    { session }
                );
            }

            order.isStockReserved = false;
            order.orderStatus = "Payment_Failed";
            order.paymentStatus = "FAILED";
            await order.save({ session });
            console.log(`Released stock for abandoned Order #${order._id}`);
        }
        await session.commitTransaction();
    } catch (err) {
        await session.abortTransaction();
        console.error("Stock Release Cron Error:", err);
    } finally {
        session.endSession();
    }
});

// ------------------ START SERVER ------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});