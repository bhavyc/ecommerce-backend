// controllers/admin/adminOrderController.js
const Order = require("../../models/Order");
const User = require("../../models/User");
const mongoose = require("mongoose");
exports.renderOrderPage = async (req, res) => {
    res.render("admin/orders/list", { user: req.user });
};

// 2. AJAX Data Fetch karne ke liye
exports.getOrderData = async (req, res) => {
    try {
        const { from, to, search, page = 1, limit = 10 } = req.query;
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

        // Search Logic (Order ID ka last 6 digit ya User Name/Email)
        if (search) {
            const matchingUsers = await User.find({
                $or: [
                    { name: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } }
                ]
            }).select("_id");

            const userIds = matchingUsers.map(u => u._id);
            
            query.$or = [
                { user: { $in: userIds } },
                // MongoDB ki full ID par search ke liye
                { _id: mongoose.isValidObjectId(search) ? search : undefined } 
            ].filter(Boolean);

            // Agar Order ID ke last characters se search karna hai toh Regex (Thoda heavy ho sakta hai)
            if(!mongoose.isValidObjectId(search)) {
                query.$or.push({ razorpayOrderId: { $regex: search, $options: "i" } });
            }
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const totalCount = await Order.countDocuments(query);
        
        const orders = await Order.find(query)
            .populate("user", "name email")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        res.json({
            success: true,
            orders,
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