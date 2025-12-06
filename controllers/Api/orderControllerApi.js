const Order = require("../../models/Order");
const Cart = require("../../models/Cart");
const User = require("../../models/User");
const Transaction = require("../../models/Transaction"); // Assuming you have this model
const Razorpay = require("razorpay");
const crypto = require("crypto");

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET
});

// 🟢 1. PLACE ORDER (COD or WALLET)
// 🟢 1. PLACE ORDER (COD or WALLET)
exports.placeOrder = async (req, res) => {
  try {
    const userId = req.user ? (req.user.id || req.user._id || req.user.userId) : null;

    if (!userId) {
      return res.status(401).json({ success: false, message: "User ID missing. Please login again." });
    }

    const { paymentMethod, shippingAddress } = req.body;

    // 1. Cart dhoondho
    const cart = await Cart.findOne({ user: userId });

    console.log(`Placing Order for User: ${userId}`);

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty (Backend)" });
    }

    // 2. Total Amount
    const totalAmount = cart.totalAmount;
    let finalPaymentStatus = "PENDING";

    // 3. Handle Wallet Payment
    if (paymentMethod === "WALLET") {
      const user = await User.findById(userId);
      
      if (user.walletBalance < totalAmount) {
        return res.status(400).json({ success: false, message: "Insufficient Wallet Balance" });
      }

      user.walletBalance -= totalAmount;
      await user.save();

      await Transaction.create({
        user: userId,
        amount: totalAmount,
        type: "DEBIT",
        description: "Order Payment",
        status: "SUCCESS"
      });

      finalPaymentStatus = "PAID";
    }

    // 4. Create Order
    const order = new Order({
      user: userId,
      items: cart.items,
      totalAmount: totalAmount,
      shippingAddress: shippingAddress || { fullName: "User", city: "India" },
      paymentMethod: paymentMethod,
      paymentStatus: finalPaymentStatus,
      orderStatus: "Processing"
    });

    await order.save(); // ✅ Order Save Ho Gaya

    // ---------------------------------------------------------
    // 💧 1. GAME LOGIC: Give Water Drops
    // ---------------------------------------------------------
    try {
      const dropsEarned = Math.floor(totalAmount / 10);
      await User.findByIdAndUpdate(userId, { 
        $inc: { "game.waterDrops": dropsEarned } 
      });
    } catch (err) {
      console.error("Game update error", err);
    }

    // ---------------------------------------------------------
    // 💰 2. REFERRAL LOGIC: Give ₹50 to Referrer (NEW ADDITION)
    // ---------------------------------------------------------
    try {
      const currentUser = await User.findById(userId);

      // Check: Kya ye pehla order hai?
      if (!currentUser.isFirstOrderDone) {
        
        // Scenario: Agar kisi ne refer kiya tha
        if (currentUser.referredBy) {
           const referrerId = currentUser.referredBy;
           const rewardAmount = 50; 

           // A. Referrer ke wallet mein paise daalo
           await User.findByIdAndUpdate(referrerId, {
             $inc: { walletBalance: rewardAmount }
           });

           // B. Transaction Record banao
           await Transaction.create({
             user: referrerId,
             amount: rewardAmount,
             type: "CREDIT",
             description: `Referral Bonus: ${currentUser.name} placed first order!`,
             status: "SUCCESS"
           });

           console.log(`Referral Reward: ₹50 sent to ${referrerId}`);
        }

        // Scenario: Pehla order mark kar do (taaki baar baar reward na mile)
        currentUser.isFirstOrderDone = true;
        await currentUser.save();
      }
    } catch (refErr) {
      console.error("Referral Logic Error:", refErr);
    }
    // ---------------------------------------------------------

    // 5. Cart Khali karo
    await Cart.findOneAndUpdate({ user: userId }, { items: [], totalAmount: 0 });

    res.status(201).json({
      success: true,
      message: "Order placed successfully!",
      orderId: order._id
    });

  } catch (err) {
    console.error("Place Order Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
// 🟢 2. GET MY ORDERS
// 🟢 GET MY ORDERS
exports.getMyOrders = async (req, res) => {
  try {
    // 🔴 FIX: Robust ID Check (Jaisa Cart/Order mein kiya tha)
    const userId = req.user ? (req.user.id || req.user._id || req.user.userId) : null;

    if (!userId) {
      return res.status(401).json({ success: false, message: "User ID missing" });
    }

    console.log("Fetching orders for:", userId); // Debugging Log

    // Orders fetch karo (Latest first)
    const orders = await Order.find({ user: userId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      orders
    });

  } catch (err) {
    console.error("Get Orders Error:", err);
    res.status(500).json({ success: false, message: "Error fetching orders" });
  }
};

// 🟢 3. GET SINGLE ORDER DETAILS
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Ensure user only sees their own order
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    res.status(200).json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching order" });
  }
};

// ==========================================
// 💳 ONLINE PAYMENT (RAZORPAY)
// ==========================================

// 🟢 4. INITIALIZE RAZORPAY ORDER
exports.createRazorpayOrder = async (req, res) => {
  try {
    const userId = req.user._id;

    // SECURITY: Calculate amount from Server Cart, NOT from req.body
    const cart = await Cart.findOne({ user: userId });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    const amountInPaise = Math.round(cart.totalAmount * 100); // INR to Paise

    const options = {
      amount: amountInPaise, 
      currency: "INR",
      receipt: `order_${Date.now()}`,
    };

    const razorpayOrder = await razorpay.orders.create(options);

    res.status(200).json({
      success: true,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key: RAZORPAY_KEY_ID // Send Key ID to frontend
    });

  } catch (err) {
    console.error("Razorpay Create Error:", err);
    res.status(500).json({ success: false, message: "Error initiating payment" });
  }
};

// 🟢 5. VERIFY PAYMENT & PLACE ORDER
exports.verifyRazorpayPayment = async (req, res) => {
  try {
    const userId = req.user._id;
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature, 
      shippingAddress // Frontend sends full address object
    } = req.body;

    // A. Signature Verification
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Invalid Payment Signature" });
    }

    // B. Place Order in DB
    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(400).json({ success: false, message: "Cart not found" });

    const order = new Order({
      user: userId,
      items: cart.items,
      totalAmount: cart.totalAmount,
      shippingAddress: shippingAddress,
      paymentMethod: "ONLINE",
      paymentStatus: "PAID",
      orderStatus: "Pending",
      transactionId: razorpay_payment_id 
    });

    await order.save();
    
    // Clear Cart
    await Cart.findOneAndUpdate({ user: userId }, { items: [], totalAmount: 0 });

    res.status(200).json({
      success: true,
      message: "Payment successful, Order placed!",
      orderId: order._id
    });

  } catch (err) {
    console.error("Payment Verify Error:", err);
    res.status(500).json({ success: false, message: "Payment Verification Failed" });
  }
};