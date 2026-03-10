const SlotBooking = require("../../models/SlotBooking");
const Product = require("../../models/Product");
const Transaction = require("../../models/Transaction");
const Razorpay = require("razorpay");
const crypto = require("crypto");

// Razorpay Instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Prices Configuration
const PRICES = {
  DROP: 500, // ₹500 for 15 Min Drop
  DEAL: 200  // ₹200 for 24 Hr Deal
};

// Limits (Weekly)
const LIMITS = {
  DROP: 5,  
  DEAL: 10 
};

// ==========================================
// 1. RENDER PAGE
// ==========================================
exports.renderSlotPage = async (req, res) => {
  try {
    const sellerId = req.user._id;
    const products = await Product.find({ seller: sellerId });

    const today = new Date();
    today.setHours(0,0,0,0);

    const lastBooking = await SlotBooking.findOne({ 
      seller: sellerId, 
      status: "PAID" 
    }).sort({ createdAt: -1 });

    let isCooldownActive = false;
    let daysLeft = 0;

    if (lastBooking) {
      const lastDate = new Date(lastBooking.createdAt);
      lastDate.setHours(0,0,0,0);
      const diffTime = Math.abs(today - lastDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 7 && lastDate.getTime() !== today.getTime()) {
        isCooldownActive = true;
        daysLeft = 7 - diffDays;
      }
    }

    const dropsUsed = await SlotBooking.countDocuments({ seller: sellerId, type: "DROP", status: "PAID", createdAt: { $gte: today } });
    const dealsUsed = await SlotBooking.countDocuments({ seller: sellerId, type: "DEAL", status: "PAID", createdAt: { $gte: today } });

    res.render("seller/buySlot", {
      user: req.user,
      products,
      isCooldownActive,
      daysLeft,
      limits: { drop: 3, deal: 5 },
      used: { drop: dropsUsed, deal: dealsUsed },
      razorpayKey: process.env.RAZORPAY_KEY_ID
    });

  } catch (err) {
    console.error("Render Error:", err);
    res.status(500).send("Server Error");
  }
};

// ==========================================
// 2. CREATE ORDER (Initiate Payment)
// ==========================================
exports.createSlotOrder = async (req, res) => {
  try {
    const sellerId = req.user._id;
    const { productId, type, discount } = req.body; 

    // --- A. VALIDATIONS ---
    if (type === "DROP" && discount < 40) {
      return res.status(400).json({ success: false, msg: "Drops ke liye Min 40% Discount zaroori hai!" });
    }
    if (type === "DEAL" && discount < 10) {
      return res.status(400).json({ success: false, msg: "Deals ke liye Min 10% Discount zaroori hai!" });
    }

    // --- B. WEEKLY LIMITS CHECK ---
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const currentCount = await SlotBooking.countDocuments({ 
      seller: sellerId, type: type, status: "PAID", createdAt: { $gte: sevenDaysAgo } 
    });

    const maxLimit = LIMITS[type];
    if (currentCount >= maxLimit) {
      return res.status(400).json({ 
          success: false, 
          msg: `Limit Reached! Aap pichle 7 din mein ${currentCount} ${type} slots book kar chuke hain.` 
      });
    }

    // --- C. RAZORPAY ORDER ---
    const amount = PRICES[type] * 100;
    
    const options = {
      amount: amount,
      currency: "INR",
      // 🔥 FIX: Receipt length must be under 40. 
      // sl (2) + _ (1) + shortID (6) + _ (1) + timestamp (13) = 23 chars. Safe.
      receipt: `sl_${sellerId.toString().slice(-6)}_${Date.now()}` 
    };

    const order = await razorpay.orders.create(options);

    // --- D. SAVE AS PENDING ---
    const newBooking = new SlotBooking({
      seller: sellerId,
      product: productId,
      type: type,
      amountPaid: PRICES[type],
      razorpayOrderId: order.id,
      status: "PENDING",
      discount: Number(discount),
      isProcessed: false 
    });

    await newBooking.save();

    res.json({ success: true, order, bookingId: newBooking._id });

  } catch (err) {
    console.error("Order Create Error:", err);
    res.status(500).json({ success: false, msg: "Server Error" });
  }
};

// ==========================================
// 3. VERIFY PAYMENT
// ==========================================
exports.verifySlotPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, msg: "Payment Verification Failed" });
    }

    const booking = await SlotBooking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, msg: "Booking not found" });

    booking.status = "PAID";
    booking.razorpayPaymentId = razorpay_payment_id;
    await booking.save();

    // ✅ ACCOUNTING LOG (Transaction model se match karta hua)
    await Transaction.create({
      user: booking.seller,
      amount: booking.amountPaid,
      type: "DEBIT", 
      description: `Slot Purchased: ${booking.type} Priority`,
      status: "SUCCESS",
      paymentGateway: "RAZORPAY",
      gatewayTransactionId: razorpay_payment_id
    });

    res.json({ success: true, msg: "Slot Booked! Your product is in the priority queue." });

  } catch (err) {
    console.error("Verify Error:", err);
    res.status(500).json({ success: false, msg: "Server Error" });
  }
};

// controllers/seller/sellerSlotController.js mein add karo

// 1. Page Render karne ke liye
exports.renderSlotHistoryPage = async (req, res) => {
    res.render("seller/slots/history", { user: req.user });
};

// 2. Data Fetch Logic (AJAX Pagination)
exports.getSellerSlotData = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const sellerId = req.user._id;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const totalCount = await SlotBooking.countDocuments({ seller: sellerId, status: "PAID" });

        const slots = await SlotBooking.find({ seller: sellerId, status: "PAID" })
            .populate("product", "title image")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        res.json({
            success: true,
            slots,
            pagination: {
                totalCount,
                totalPages: Math.ceil(totalCount / limit),
                currentPage: parseInt(page)
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// const SlotBooking = require("../../models/SlotBooking");
// const Product = require("../../models/Product");
// const Transaction = require("../../models/Transaction"); // ✅ Added for Record Keeping
// const Razorpay = require("razorpay");
// const crypto = require("crypto");

// // Razorpay Instance
// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET
// });

// // Prices Configuration
// const PRICES = {
//   DROP: 500, // ₹500 for 15 Min Drop
//   DEAL: 200  // ₹200 for 24 Hr Deal
// };

// // Limits (Weekly)
// const LIMITS = {
//   DROP: 5,  
//   DEAL: 10 
// };
// // ==========================================
// // 1. RENDER PAGE (Slot Booking Form)
// // ==========================================
// exports.renderSlotPage = async (req, res) => {
//   try {
//     const sellerId = req.user._id;
    
//     // 1. Seller ke products fetch karo
//     const products = await Product.find({ seller: sellerId });

//     // 2. Cooldown Logic (1 Week Gap Rule)
//     const today = new Date();
//     today.setHours(0,0,0,0);

//     const lastBooking = await SlotBooking.findOne({ 
//       seller: sellerId, 
//       status: "PAID" 
//     }).sort({ createdAt: -1 });

//     let isCooldownActive = false;
//     let daysLeft = 0;

//     if (lastBooking) {
//       const lastDate = new Date(lastBooking.createdAt);
//       lastDate.setHours(0,0,0,0);

//       const diffTime = Math.abs(today - lastDate);
//       const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

//       // Rule: Agar 7 din nahi hue AUR booking aaj ki nahi hai -> Block
//       if (diffDays < 7 && lastDate.getTime() !== today.getTime()) {
//         isCooldownActive = true;
//         daysLeft = 7 - diffDays;
//       }
//     }

//     // 3. Daily Limits Check
//     const dropsUsed = await SlotBooking.countDocuments({ seller: sellerId, type: "DROP", status: "PAID", createdAt: { $gte: today } });
//     const dealsUsed = await SlotBooking.countDocuments({ seller: sellerId, type: "DEAL", status: "PAID", createdAt: { $gte: today } });

//     res.render("seller/buySlot", {
//       user: req.user,
//       products,
//       isCooldownActive,
//       daysLeft,
//       limits: { drop: 3, deal: 5 },
//       used: { drop: dropsUsed, deal: dealsUsed },
//       razorpayKey: process.env.RAZORPAY_KEY_ID
//     });

//   } catch (err) {
//     console.error("Render Error:", err);
//     res.status(500).send("Server Error");
//   }
// };

// // ==========================================
// // 2. CREATE ORDER (Initiate Payment)
// // ==========================================
// // exports.createSlotOrder = async (req, res) => {
// //   try {
// //     const sellerId = req.user._id;
// //     const { productId, type, discount } = req.body; // type = "DROP" or "DEAL"

// //     // --- Validations ---
// //     if (type === "DROP" && discount < 40) {
// //       return res.status(400).json({ success: false, msg: "15 Min Drops ke liye Min 40% Discount zaroori hai!" });
// //     }
// //     if (type === "DEAL" && discount < 10) {
// //       return res.status(400).json({ success: false, msg: "24 Hr Deals ke liye Min 10% Discount zaroori hai!" });
// //     }

// //     // Daily Limits Check
// //     const today = new Date();
// //     today.setHours(0,0,0,0);
// //     const limit = type === "DROP" ? 3 : 5;
// //     const currentCount = await SlotBooking.countDocuments({ 
// //       seller: sellerId, type: type, status: "PAID", createdAt: { $gte: today } 
// //     });

// //     if (currentCount >= limit) {
// //       return res.status(400).json({ success: false, msg: `Aaj ki limit poori ho gayi hai (${type})` });
// //     }

// //     // --- Razorpay Order ---
// //     const amount = PRICES[type] * 100; // Paise mein
// //     const order = await razorpay.orders.create({
// //       amount: amount,
// //       currency: "INR",
// //       receipt: `slot_${sellerId}_${Date.now()}`
// //     });

// //     // Save as PENDING
// //     const newBooking = new SlotBooking({
// //       seller: sellerId,
// //       product: productId,
// //       type: type,
// //       amountPaid: PRICES[type],
// //       razorpayOrderId: order.id,
// //       status: "PENDING",
// //       discount: Number(discount),
// //       isProcessed: false 
// //     });

// //     await newBooking.save();

// //     res.json({ success: true, order, bookingId: newBooking._id });

// //   } catch (err) {
// //     console.error("Order Create Error:", err);
// //     res.status(500).json({ success: false, msg: "Server Error" });
// //   }
// // };


// exports.createSlotOrder = async (req, res) => {
//   try {
//     const sellerId = req.user._id;
//     const { productId, type, discount } = req.body; // type = "DROP" or "DEAL"

//     // --- A. VALIDATIONS (Discount Rules) ---
//     if (type === "DROP" && discount < 40) {
//       return res.status(400).json({ success: false, msg: "Drops ke liye Min 40% Discount zaroori hai!" });
//     }
//     if (type === "DEAL" && discount < 10) {
//       return res.status(400).json({ success: false, msg: "Deals ke liye Min 10% Discount zaroori hai!" });
//     }

//     // --- B. WEEKLY LIMITS CHECK ---
//     const sevenDaysAgo = new Date();
//     sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

//     const currentCount = await SlotBooking.countDocuments({ 
//       seller: sellerId, 
//       type: type, 
//       status: "PAID", 
//       createdAt: { $gte: sevenDaysAgo } 
//     });

//     const maxLimit = LIMITS[type]; // 5 for DROP, 10 for DEAL

//     if (currentCount >= maxLimit) {
//       return res.status(400).json({ 
//           success: false, 
//           msg: `Limit Reached! Aap pichle 7 din mein ${currentCount} ${type} slots book kar chuke hain. (Max: ${maxLimit})` 
//       });
//     }

//     // --- C. RAZORPAY ORDER ---
//     const amount = PRICES[type] * 100; // Paise mein
//     const order = await razorpay.orders.create({
//       amount: amount,
//       currency: "INR",
//       receipt: `slot_${sellerId}_${Date.now()}`
//     });

//     // --- D. SAVE AS PENDING ---
//     const newBooking = new SlotBooking({
//       seller: sellerId,
//       product: productId,
//       type: type,
//       amountPaid: PRICES[type],
//       razorpayOrderId: order.id,
//       status: "PENDING",
//       discount: Number(discount),
//       isProcessed: false 
//     });

//     await newBooking.save();

//     res.json({ success: true, order, bookingId: newBooking._id });

//   } catch (err) {
//     console.error("Order Create Error:", err);
//     res.status(500).json({ success: false, msg: "Server Error" });
//   }
// };

// // ==========================================
// // 3. VERIFY PAYMENT & SAVE TRANSACTION
// // ==========================================
// exports.verifySlotPayment = async (req, res) => {
//   try {
//     const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

//     // Signature Match
//     const body = razorpay_order_id + "|" + razorpay_payment_id;
//     const expectedSignature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
//       .update(body.toString())
//       .digest("hex");

//     if (expectedSignature !== razorpay_signature) {
//       return res.status(400).json({ success: false, msg: "Payment Verification Failed" });
//     }

//     // 1. Mark Booking as PAID
//     const booking = await SlotBooking.findById(bookingId);
//     if (!booking) return res.status(404).json({ success: false, msg: "Booking not found" });

//     booking.status = "PAID";
//     booking.razorpayPaymentId = razorpay_payment_id;
//     await booking.save();

//     // 2. ✅ SAVE TRANSACTION RECORD (Accounting)
//     await Transaction.create({
//       user: booking.seller,
//       amount: booking.amountPaid,
//       type: "DEBIT", // Paisa gaya seller se
//       description: `Slot Purchased: ${booking.type} Priority`,
//       status: "SUCCESS",
//       paymentGateway: "RAZORPAY",
//       gatewayTransactionId: razorpay_payment_id
//     });

//     // Automation Engine will automatically pick this up because isProcessed is false
//     res.json({ success: true, msg: "Slot Booked! Your product is in the priority queue." });

//   } catch (err) {
//     console.error("Verify Error:", err);
//     res.status(500).json({ success: false, msg: "Server Error" });
//   }
// };

// exports.bookSlot = async (req, res) => {
//   try {
//     const sellerId = req.user._id;
//     const { productId, type, discount } = req.body; // type: 'DROP' or 'DEAL'

//     // 1. Calculate Date 7 Days Ago
//     const sevenDaysAgo = new Date();
//     sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

//     // 2. Count bookings in last 7 days
//     const bookingCount = await SlotBooking.countDocuments({
//         seller: sellerId,
//         type: type,
//         createdAt: { $gte: sevenDaysAgo } // Pichle 7 din se ab tak
//     });

//     // 3. Apply Limits
//     if (type === "DROP" && bookingCount >= 5) {
//         return res.status(400).json({ success: false, message: "Limit reached! You can only book 5 Drops per week." });
//     }
//     if (type === "DEAL" && bookingCount >= 10) {
//         return res.status(400).json({ success: false, message: "Limit reached! You can only book 10 Deals per week." });
//     }

//     // 4. Calculate Amount (Example logic - Apne hisaab se adjust kar lena)
//     let amount = type === "DROP" ? 500 : 200; // Drop mehnga, Deal sasta

//     // 5. Create Razorpay Order
//     const options = {
//         amount: amount * 100, // Paise
//         currency: "INR",
//         receipt: `slot_${sellerId}_${Date.now()}`
//     };
    
//     const order = await razorpay.orders.create(options);

//     // 6. Save Pending Booking to DB
//     const newSlot = new SlotBooking({
//         seller: sellerId,
//         product: productId,
//         type,
//         amountPaid: amount,
//         discount: discount || 0, // Seller ka discount save karo
//         razorpayOrderId: order.id,
//         status: "PENDING",
//         isProcessed: false
//     });

//     await newSlot.save();

//     res.status(200).json({
//         success: true,
//         orderId: order.id,
//         amount: amount,
//         key: process.env.RAZORPAY_KEY_ID,
//         slotId: newSlot._id
//     });

//   } catch (err) {
//     console.error("Slot Booking Error:", err);
//     res.status(500).json({ success: false, message: "Server error booking slot" });
//   }
// };