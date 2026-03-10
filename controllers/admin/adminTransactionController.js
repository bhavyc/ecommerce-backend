// controllers/admin/adminTransactionController.js
const Transaction = require("../../models/Transaction");
const User = require("../../models/User");

// 1. Page Shell Render
exports.renderTransactionPage = async (req, res) => {
    res.render("admin/transactions/list", { user: req.user });
};

// 2. Data Fetch Logic (AJAX)
exports.getTransactionData = async (req, res) => {
    try {
        const { from, to, search, type, status, page = 1, limit = 15 } = req.query;
        let query = {};

        // Date Filter
        if (from || to) {
            query.createdAt = {};
            if (from) query.createdAt.$gte = new Date(from);
            if (to) {
                let toDate = new Date(to);
                toDate.setHours(23, 59, 59, 999);
                query.createdAt.$lte = toDate;
            }
        }

        // Type & Status Filter
        if (type) query.type = type;
        if (status) query.status = status;

        // User Search (Name or Email)
        if (search) {
            const matchingUsers = await User.find({
                $or: [
                    { name: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } }
                ]
            }).select("_id");
            query.user = { $in: matchingUsers.map(u => u._id) };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const totalCount = await Transaction.countDocuments(query);
        
        const transactions = await Transaction.find(query)
            .populate("user", "name email role")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        res.json({
            success: true,
            transactions,
            pagination: {
                totalCount,
                totalPages: Math.ceil(totalCount / limit),
                currentPage: parseInt(page)
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};