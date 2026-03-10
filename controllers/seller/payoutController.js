// controllers/seller/payoutController.js
const User = require("../../models/User");
const PayoutRequest = require("../../models/PayoutRequest");
// If you have a Transaction model, import it too, otherwise comment this out
const Transaction = require("../../models/Transaction"); 
const SellerProfile= require("../../models/SellerProfile")
// 1. Get Wallet Balance
exports.getWalletData = async (req, res) => {
  try {
    // req.user comes from your auth middleware
    const user = await User.findById(req.user._id);
    
    if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      walletBalance: user.walletBalance || 0,
      pendingBalance: user.pendingBalance || 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// 2. Request Payout
exports.requestPayout = async (req, res) => {
  try {
    const amount = parseFloat(req.body.amount);
    // User ID nikalne ka sahi tarika
    const sellerId = req.user ? (req.user.id || req.user._id) : null;

    if (!sellerId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // A. Validation
    if (!amount || amount < 100) {
      return res.status(400).json({ success: false, message: "Minimum withdrawal is ₹100" });
    }

    // Dono Models fetch karo: User (Balance ke liye) aur Profile (Bank details ke liye)
    const user = await User.findById(sellerId);
    const profile = await SellerProfile.findOne({ seller: sellerId });

    // Check karo ki profile aur bank details hain ya nahi
    if (!profile || !profile.bankAccountNo || !profile.ifscCode) {
      return res.status(400).json({ 
        success: false, 
        message: "Bank details missing in your profile. Please update them first." 
      });
    }

    // B. Check Balance
    if (user.walletBalance < amount) {
      return res.status(400).json({ success: false, message: "Insufficient Wallet Balance" });
    }

    // C. Deduct Money from Wallet
    user.walletBalance -= amount;
    await user.save();

    // D. Create Payout Request Record
    const payout = new PayoutRequest({
      seller: sellerId, 
      amount: amount,
      status: "PENDING",
      bankDetails: {
        // 🔥 FIX: 'user' ki jagah 'profile' se data uthao
        accountNumber: profile.bankAccountNo, 
        ifsc: profile.ifscCode,
        accountName: profile.businessName || user.name
      }
    });
    await payout.save();

    // E. Transaction Log
    if (typeof Transaction !== 'undefined') {
        await Transaction.create({
            user: sellerId,
            amount: amount,
            type: "DEBIT",
            description: `Payout Request #${payout._id.toString().slice(-6)}`,
            status: "PENDING",
            paymentGateway: "SYSTEM"
        });
    }

    res.json({ success: true, message: "Payout requested successfully", remainingBalance: user.walletBalance });

  } catch (err) {
    console.error("Payout Error:", err);
    res.status(500).json({ success: false, message: "Server error processing payout" });
  }
};
// 3. Get History
// controllers/seller/payoutController.js

// controllers/seller/payoutController.js

exports.getPayoutHistory = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Default page 1
        const limit = parseInt(req.query.limit) || 10; // Ek page par 10 records
        const skip = (page - 1) * limit;

        const sellerId = req.user._id;

        // 1. Total records count karo (Pagination calculation ke liye)
        const totalRecords = await PayoutRequest.countDocuments({ seller: sellerId });

        // 2. Data fetch karo skip aur limit ke sath
        const payouts = await PayoutRequest.find({ seller: sellerId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            success: true,
            payouts,
            currentPage: page,
            totalPages: Math.ceil(totalRecords / limit),
            totalCount: totalRecords
        });
    } catch (err) {
        console.error("Fetch History Error:", err);
        res.status(500).json({ success: false, message: "Error fetching history" });
    }
};