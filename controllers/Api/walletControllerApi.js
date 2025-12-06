const User = require("../../models/User"); // Path check kar lena
const Transaction = require("../../models/Transaction");

exports.getWallet = async (req, res) => {
  try {
    // 🔴 FIX: Robust ID Check (Jaisa Cart mein kiya tha)
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