const User = require("../../models/User"); // Path check kar lena
const Transaction = require("../../models/Transaction");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const sendNotification = require("../../utils/sendNotification");
const Notification = require("../../models/Notification");
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// 1. Order Create Karo (Frontend isse call karega)
exports.createWalletOrder = async (req, res) => {
 
  try {
    const { amount } = req.body; // Amount in Rupees
    if (!amount || amount < 1) return res.status(400).json({ msg: "Invalid Amount" });

    const options = {
      amount: amount * 100, // Convert to Paise
      currency: "INR",
      receipt: `wallet_${req.user._id}_${Date.now()}`
    };


    const order = await razorpay.orders.create(options);
   
    res.json({ success: true, order
      ,key: process.env.RAZORPAY_KEY_ID
     });

  } catch (err) {
    res.status(500).json({ success: false, msg: "Server Error" });
  }
};

// 2. Verify Payment & Add Balance (Payment hone ke baad call hoga)
exports.verifyWalletAdd = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;

    // 1. Signature check (Security)
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, msg: "Invalid Signature" });
    }

    // 🔥 FIX: User ID nikalne ka sahi tareeka (id ya _id dono check karega)
    const userId = req.user ? (req.user.id || req.user._id) : null;

    if (!userId) {
      console.error("User ID missing in request");
      return res.status(401).json({ success: false, msg: "User session not found" });
    }

    // 2. Wallet balance update karo
    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { walletBalance: Number(amount) } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found in database" });
    }

    // 3. Transaction Log banao
    // Line 79 fix: Ab 'user' field mein 100% ID jayegi
    await Transaction.create({
      user: userId, 
      amount: Number(amount),
      type: "CREDIT",
      description: "Wallet Top-up via Online",
      status: "SUCCESS",
      paymentGateway: "RAZORPAY",
      gatewayTransactionId: razorpay_payment_id
    });

    // 4. Notification bhejo
    await sendNotification(
      userId, 
      "Wallet Top-up Success! 💰", 
      `₹${amount} has been added to your BharatMart wallet.`, 
      "WALLET"
    );

    res.json({ 
      success: true, 
      msg: "Money Added Successfully!", 
      newBalance: user.walletBalance 
    });

  } catch (err) {
    console.error("Verify Wallet Error:", err);
    res.status(500).json({ success: false, msg: "Verification Error", error: err.message });
  }
};


exports.getWallet = async (req, res) => {
  try {
    //  FIX: Robust ID Check (Jaisa Cart mein kiya tha)
    const userId = req.user ? (req.user.id || req.user._id || req.user.userId) : null;

    if (!userId) {
      return res.status(401).json({ success: false, message: "User ID missing" });
    }

    // User aur Transactions fetch karo
    const user = await User.findById(userId);
    const transactions = await Transaction.find({ user: userId }).sort({ createdAt: -1 });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      // Agar balance undefined hai toh 0 dikhao
      walletBalance: user.walletBalance || 0, 
      transactions: transactions || []
    });

  } catch (err) {
    console.error("Wallet Error:", err); // Terminal mein error dekho
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.addMoney = async (req, res) => {
  try {
    const userId = req.user ? (req.user.id || req.user._id || req.user.userId) : null;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid Amount" });
    }

    // Update Balance
    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { walletBalance: amount } }, // Increment balance
      { new: true }
    );

    // Create Transaction Log
    const transaction = await Transaction.create({
      user: userId,
      amount: amount,
      type: "CREDIT",
      description: "Wallet Top-up",
      status: "SUCCESS"
    });

    res.status(200).json({
      success: true,
      message: "Money Added",
      walletBalance: user.walletBalance,
      transaction
    });

  } catch (err) {
    console.error("Add Money Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};