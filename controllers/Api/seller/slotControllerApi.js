// controllers/seller/slotController.js
const SlotBooking = require("../../models/SlotBooking");
const Product = require("../../models/Product");
const Transaction = require("../../models/Transaction");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const PRICES = { DROP: 500, DEAL: 200 };

// 1. Get Page Info (Cooldowns & Limits)
exports.getSlotPageData = async (req, res) => {
  try {
    const sellerId = req.user._id;
    const products = await Product.find({ seller: sellerId }).select("title _id");

    const today = new Date();
    today.setHours(0,0,0,0);

    // Cooldown Logic
    const lastBooking = await SlotBooking.findOne({ seller: sellerId, status: "PAID" }).sort({ createdAt: -1 });
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

    // Daily Limits
    const dropsUsed = await SlotBooking.countDocuments({ seller: sellerId, type: "DROP", status: "PAID", createdAt: { $gte: today } });
    const dealsUsed = await SlotBooking.countDocuments({ seller: sellerId, type: "DEAL", status: "PAID", createdAt: { $gte: today } });

    res.json({
      success: true,
      products,
      status: {
        isCooldownActive,
        daysLeft,
        limits: { drop: 3, deal: 5 },
        used: { drop: dropsUsed, deal: dealsUsed }
      },
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// 2. Create Razorpay Order
exports.createSlotOrder = async (req, res) => {
  try {
    const sellerId = req.user._id;
    const { productId, type, discount } = req.body; 

    // Validation
    if ((type === "DROP" && discount < 40) || (type === "DEAL" && discount < 10)) {
      return res.status(400).json({ success: false, message: "Insufficient Discount" });
    }

    // Check Limits
    const today = new Date();
    today.setHours(0,0,0,0);
    const limit = type === "DROP" ? 3 : 5;
    const currentCount = await SlotBooking.countDocuments({ seller: sellerId, type, status: "PAID", createdAt: { $gte: today } });

    if (currentCount >= limit) {
      return res.status(400).json({ success: false, message: `Daily limit reached for ${type}` });
    }

    const amount = PRICES[type] * 100;
    const order = await razorpay.orders.create({
      amount: amount,
      currency: "INR",
      receipt: `slot_${sellerId}_${Date.now()}`
    });

    const newBooking = new SlotBooking({
      seller: sellerId,
      product: productId,
      type,
      amountPaid: PRICES[type],
      razorpayOrderId: order.id,
      status: "PENDING",
      discount: Number(discount),
      isProcessed: false 
    });

    await newBooking.save();
    res.json({ success: true, order, bookingId: newBooking._id });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Order creation failed" });
  }
};

// 3. Verify Payment
exports.verifySlotPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Invalid Signature" });
    }

    const booking = await SlotBooking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    booking.status = "PAID";
    booking.razorpayPaymentId = razorpay_payment_id;
    await booking.save();

    await Transaction.create({
      user: booking.seller,
      amount: booking.amountPaid,
      type: "DEBIT",
      description: `Slot Purchased: ${booking.type}`,
      status: "SUCCESS",
      paymentGateway: "RAZORPAY",
      gatewayTransactionId: razorpay_payment_id
    });

    res.json({ success: true, message: "Slot Booked Successfully" });

  } catch (err) {
    res.status(500).json({ success: false, message: "Payment Verification Failed" });
  }
};

exports.bookSlot = async (req, res) => {
  try {
    const sellerId = req.user._id;
    const { productId, type, discount } = req.body; // type: 'DROP' or 'DEAL'

    // 1. Calculate Date 7 Days Ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 2. Count bookings in last 7 days
    const bookingCount = await SlotBooking.countDocuments({
        seller: sellerId,
        type: type,
        createdAt: { $gte: sevenDaysAgo } // Pichle 7 din se ab tak
    });

    // 3. Apply Limits
    if (type === "DROP" && bookingCount >= 5) {
        return res.status(400).json({ success: false, message: "Limit reached! You can only book 5 Drops per week." });
    }
    if (type === "DEAL" && bookingCount >= 10) {
        return res.status(400).json({ success: false, message: "Limit reached! You can only book 10 Deals per week." });
    }

    // 4. Calculate Amount (Example logic - Apne hisaab se adjust kar lena)
    let amount = type === "DROP" ? 500 : 200; // Drop mehnga, Deal sasta

    // 5. Create Razorpay Order
    const options = {
        amount: amount * 100, // Paise
        currency: "INR",
        receipt: `slot_${sellerId}_${Date.now()}`
    };
    
    const order = await razorpay.orders.create(options);

    // 6. Save Pending Booking to DB
    const newSlot = new SlotBooking({
        seller: sellerId,
        product: productId,
        type,
        amountPaid: amount,
        discount: discount || 0, // Seller ka discount save karo
        razorpayOrderId: order.id,
        status: "PENDING",
        isProcessed: false
    });

    await newSlot.save();

    res.status(200).json({
        success: true,
        orderId: order.id,
        amount: amount,
        key: process.env.RAZORPAY_KEY_ID,
        slotId: newSlot._id
    });

  } catch (err) {
    console.error("Slot Booking Error:", err);
    res.status(500).json({ success: false, message: "Server error booking slot" });
  }
};
