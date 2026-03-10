const User = require("../../models/User");
const PayoutRequest = require("../../models/PayoutRequest");
const SellerProfile = require("../../models/SellerProfile");




exports.requestPayout = async (req, res) => {
    try {
        const { amount } = req.body;
        // Robust ID check
        const sellerId = req.user ? (req.user.id || req.user._id) : null;
        
        if (!amount || amount < 100) {
            return res.status(400).json({ success: false, message: "Minimum payout amount is ₹100" });
        }

        // 1. Fetch User & Profile
        const user = await User.findById(sellerId);
        const profile = await SellerProfile.findOne({ seller: sellerId });

        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        
        // 2. Validate Bank Details
        if (!profile || !profile.bankAccountNo || !profile.ifscCode) {
            return res.status(400).json({ success: false, message: "Please complete your Bank Details in profile first." });
        }

        // 3. Check Balance
        if (user.walletBalance < amount) {
            return res.status(400).json({ success: false, message: "Insufficient Wallet Balance" });
        }

        // 4. Create Payout Request
        const payout = new PayoutRequest({
    seller: sellerId,
    amount: amount,
    status: "PENDING",
    bankDetails: {
        accountName: profile.businessName || user.name,
        accountNumber: profile.bankAccountNo, // 👈 Name check karo: 'accountNumber'
        ifsc: profile.ifscCode                 // 👈 Name check karo: 'ifsc'
    }
});

        await payout.save();

        // 5. DEDUCT Balance Immediately (Lock the funds)
        // Hum funds abhi kaat lenge taaki wo dobara request na kar sake
        user.walletBalance -= amount;
        await user.save();

        // 6. Log Transaction (Internal Debit)
        await Transaction.create({
            user: sellerId,
            amount: amount,
            type: "DEBIT",
            description: `Payout Request #${payout._id.toString().slice(-6)}`,
            status: "PENDING", // Will become SUCCESS when Admin approves
            paymentGateway: "SYSTEM"
        });

        res.status(200).json({ 
            success: true, 
            message: "Payout request submitted successfully", 
            payoutId: payout._id,
            remainingBalance: user.walletBalance
        });

    } catch (err) {
        console.error("Payout Request Error:", err);
        res.status(500).json({ success: false, message: "Server error processing payout" });
    }
};

// ðŸŸ¢ Get Payout History
exports.getPayoutHistory = async (req, res) => {
    try {
        const sellerId = req.user ? (req.user.id || req.user._id) : null;
        const payouts = await PayoutRequest.find({ seller: sellerId }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, payouts });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error fetching history" });
    }
};