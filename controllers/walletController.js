const User = require("../models/User");
const Transaction = require("../models/Transaction");

// 🟢 Wallet Page Dikhana
exports.getWallet = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const transactions = await Transaction.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.render("wallet/index", { user, transactions });
  } catch (err) {
    res.send("Error: " + err.message);
  }
};

// 🟢 Paise Add Karna (Fake Top-up)
exports.addMoney = async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user._id;

    if (!amount || amount <= 0) return res.send("Invalid Amount");

    // 1. Balance Update
    await User.findByIdAndUpdate(userId, { $inc: { walletBalance: amount } });

    // 2. Transaction Record
    await Transaction.create({
      user: userId,
      amount: amount,
      type: "CREDIT",
      description: "Wallet Top-up"
    });

    res.redirect("/wallet");
  } catch (err) {
    res.send("Error: " + err.message);
  }
};