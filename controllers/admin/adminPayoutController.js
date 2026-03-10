const PayoutRequest = require("../../models/PayoutRequest");
const User = require("../../models/User");
const Transaction = require("../../models/Transaction");
 
exports.getAllPayoutRequests = async (req, res) => {
    try {
        const { from, to, search, page = 1, limit = 10 } = req.query;
        let query = {};

        // 1. Date Filter Logic
        if (from || to) {
            query.createdAt = {};
            if (from) query.createdAt.$gte = new Date(from);
            if (to) {
                let toDate = new Date(to);
                toDate.setHours(23, 59, 59, 999); // Din ke aakhri waqt tak
                query.createdAt.$lte = toDate;
            }
        }

        // 2. Search Logic (Search by Name, Email or Bank Acc)
        if (search && search.trim() !== "") {
            // Un sellers ko dhundo jinka name ya email match kare
            const matchingUsers = await User.find({
                $or: [
                    { name: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } }
                ]
            }).select("_id");

            const userIds = matchingUsers.map(u => u._id);

            query.$or = [
                { seller: { $in: userIds } },
                { "bankDetails.accountNumber": { $regex: search, $options: "i" } }
            ];
        }

        // 3. Pagination calculation
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        const totalCount = await PayoutRequest.countDocuments(query);
        const totalPages = Math.ceil(totalCount / limitNum);

        const requests = await PayoutRequest.find(query)
            .populate("seller", "name email phone walletBalance pendingBalance")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        // JSON response bhejo
        res.status(200).json({ 
            success: true, 
            requests,
            pagination: {
                totalCount,
                totalPages,
                currentPage: pageNum,
                limit: limitNum
            }
        });

    } catch (err) {
        console.error("CRITICAL ERROR IN PAYOUT API:", err);
        // Server error ka clear message
        res.status(500).json({ success: false, message: err.message });
    }
};
// 2. Process Payout (Manual Approve/Reject)
exports.processPayout = async (req, res) => {
    // Frontend se 'transactionId' zaroor bhejna jab Admin Approve kare
    const { payoutId, action, adminNote, transactionId } = req.body; 
    
    try {
        const payout = await PayoutRequest.findById(payoutId);
        if (!payout) return res.status(404).json({ success: false, message: "Request not found" });
        
        if (payout.status !== "PENDING") {
            return res.status(400).json({ success: false, message: "Request already processed" });
        }

        const sellerId = payout.seller;

        // ================= REJECT LOGIC (Same as before) =================
        if (action === "REJECT") {
            // Paisa wapas wallet mein daal do
            await User.findByIdAndUpdate(sellerId, { $inc: { walletBalance: payout.amount } });
            
            payout.status = "REJECTED";
            payout.adminNote = adminNote || "Rejected by Admin";
            await payout.save();

            // Transaction ko Failed mark karo
            await Transaction.findOneAndUpdate(
                { description: `Payout Request #${payout._id.toString().slice(-6)}`, type: "DEBIT" },
                { status: "FAILED", description: "Payout Rejected - Refunded" }
            );

            return res.status(200).json({ success: true, message: "Payout Rejected. Funds refunded to wallet." });
        }

        // ================= APPROVE LOGIC (MANUAL) =================
        if (action === "APPROVE") {
            
            // Check: Admin ne Transaction ID (UTR) dala hai ya nahi?
            if (!transactionId) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Please enter Transaction ID / UTR Number for manual verification." 
                });
            }

            // A. Update Payout Status in DB
            payout.status = "APPROVED";
            // Admin note mein likh do ki manual transfer tha
            payout.adminNote = adminNote || `Manual Transfer via Bank. UTR: ${transactionId}`;
            await payout.save();

            // B. Update Transaction Log (System ko batao paisa gaya)
            await Transaction.findOneAndUpdate(
                { description: `Payout Request #${payout._id.toString().slice(-6)}` },
                { 
                    status: "SUCCESS", 
                    paymentGateway: "MANUAL_BANK_TRANSFER", // Batana zaroori hai ki manual tha
                    gatewayTransactionId: transactionId     // Bank ka UTR number yahan save hoga
                }
            );

            // Note: Humne Razorpay API call NAHI ki. Paisa aapko phone se bhejna padega.

            return res.status(200).json({ success: true, message: "Payout Marked as Approved Manually." });
        }

    } catch (err) {
        console.error("Process Payout Error:", err);
        res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};

// Render Page (Same as before)
exports.renderPayoutsPage = async (req, res) => {
    try {
        res.render("admin/payouts", { user: req.user });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
};