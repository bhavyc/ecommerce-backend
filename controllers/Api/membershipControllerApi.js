const User = require("../../models/User");
const Transaction = require("../../models/Transaction"); // ✅ Added for Record Keeping
const Razorpay = require("razorpay");
const crypto = require("crypto");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// 1. Create Order (Membership ke liye)
exports.createMembershipOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const amount = 99 * 100; // ₹99 (Paise mein)

    const options = {
      amount: amount,
      currency: "INR",
      receipt: `mem_${userId}_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);

    res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      key: process.env.RAZORPAY_KEY_ID
    });

  } catch (err) {
    console.error("Membership Order Error:", err);
    res.status(500).json({ success: false, message: "Error creating order" });
  }
};

// 2. Verify Payment & Activate Membership

exports.verifyMembership = async (req, res) => {
  try {
    // 1. Pehle User ID nikalo (Robust way)
    const userId = req.user ? (req.user._id || req.user.id) : null;

    if (!userId) {
      return res.status(401).json({ success: false, message: "User session not found" });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // ... (Signature verification wala logic yahan rahega) ...

    // 2. Membership status update karo
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30); // 30 Days

    await User.findByIdAndUpdate(userId, {
      isMember: true,
      membershipExpiry: expiryDate
    });

    // 3. 🔥 TRANSACTION RECORD (Yahan galti thi)
    await Transaction.create({
      user: userId, // <--- Yeh line check kar, "user" field hona zaroori hai
      amount: 99,   // Membership price
      type: "DEBIT", 
      description: "Pro Membership Purchase (30 Days)",
      status: "SUCCESS",
      paymentGateway: "RAZORPAY",
      gatewayTransactionId: razorpay_payment_id
    });

    res.status(200).json({ 
      success: true, 
      message: "Membership Activated Successfully! 🌟" 
    });

  } catch (err) {
    console.error("Membership Verify Error:", err);
    res.status(500).json({ success: false, message: "Verification failed", error: err.message });
  }
};
// 3. Check Status (Frontend ke liye)
exports.checkStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const isMember = user.isMember && user.membershipExpiry > new Date();
    
    res.json({ success: true, isMember, expiry: user.membershipExpiry });
  } catch(err) {
    res.status(500).json({ success: false, msg: "Error checking status" });
  }
};