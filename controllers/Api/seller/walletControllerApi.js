// controllers/seller/walletController.js
const User = require("../../models/User");
const PayoutRequest = require("../../models/PayoutRequest");

exports.getWalletData = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    res.json({
      success: true,
      walletBalance: user.walletBalance || 0,
      pendingBalance: user.pendingBalance || 0
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.requestPayout = async (req, res) => {
  try {
    const amount = parseFloat(req.body.amount);
    const userId = req.user._id;

    if (!amount || amount < 100) {
      return res.status(400).json({ success: false, message: "Minimum withdrawal is ₹100" });
    }

    const user = await User.findById(userId);
    if (user.walletBalance < amount) {
      return res.status(400).json({ success: false, message: "Insufficient Wallet Balance" });
    }

    user.walletBalance -= amount;
    await user.save();

    const payout = new PayoutRequest({
      user: userId,
      amount: amount,
      status: "PENDING",
      adminNote: "Requested by seller"
    });
    await payout.save();

    res.json({ success: true, message: "Payout requested successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error processing payout" });
  }
};

exports.getPayoutHistory = async (req, res) => {
  try {
    const payouts = await PayoutRequest.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, payouts });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching history" });
  }
};