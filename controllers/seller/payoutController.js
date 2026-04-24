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
        const { amount } = req.body;
        const sellerId = req.user ? (req.user.id || req.user._id) : null;
        
        const payoutAmount = parseFloat(amount);

        if (!payoutAmount || payoutAmount < 100) {
            return res.status(400).json({ success: false, message: "Minimum payout amount is ₹100" });
        }

        // FIX 1: Check if any PENDING request already exists
        const existingRequest = await PayoutRequest.findOne({ 
            seller: sellerId, 
            status: "PENDING" 
        });

        if (existingRequest) {
            return res.status(400).json({ 
                success: false, 
                message: "Payout request already pending. Please wait for processing." 
            });
        }

        // 1. Fetch User & Profile
        const user = await User.findById(sellerId);
        const profile = await SellerProfile.findOne({ seller: sellerId });

        if (!user) return res.status(404).json({ success: false, message: "Seller not found" });
        
        // 2. Validate Bank Details
        if (!profile || !profile.bankAccountNo || !profile.ifscCode) {
            return res.status(400).json({ success: false, message: "Please complete your Bank Details in profile first." });
        }

        //  FIX 2: Atomic Balance Check (Strict)
        if (user.walletBalance < payoutAmount) {
            return res.status(400).json({ success: false, message: "Insufficient Wallet Balance" });
        }
         
        //3.Create Payout Request
        const payout = new PayoutRequest({
            seller: sellerId,
            amount: payoutAmount,
            status: "PENDING",
            bankDetails: {
                accountName: profile.businessName || user.name,
                accountNumber: profile.bankAccountNo,
                ifsc: profile.ifscCode
            }
        });

        await payout.save();

        // 4. DEDUCT Balance Immediately
        // Isse Seller negative mein nahi ja payega kyunki balance turant kat gaya
        user.walletBalance -= payoutAmount;
        await user.save();

        // 5. Log Transaction
        const Transaction = require("../../models/Transaction");
        await Transaction.create({
            user: sellerId,
            amount: payoutAmount,
            type: "DEBIT",
            description: `Payout Request #${payout._id.toString().slice(-6)}`,
            status: "PENDING",
            paymentGateway: "SYSTEM"
        });

        res.status(200).json({ 
            success: true, 
            message: "Payout request submitted successfully. Amount is deducted from wallet.", 
            payoutId: payout._id,
            remainingBalance: user.walletBalance
        });

    } catch (err) {
        console.error("Payout Request Error:", err);
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