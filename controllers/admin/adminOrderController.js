// controllers/admin/adminOrderController.js
const Order = require("../../models/Order");
const User = require("../../models/User");
const mongoose = require("mongoose");
const Transaction = require("../../models/Transaction");
const Inventory = require("../../models/Inventory"); // 🔥 Ye line add karni hai
 
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
            .populate("items.seller", "name businessName")
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





// controllers/admin/adminOrderController.js

// 1. Force Deliver (Specific Seller ka dabba deliver karna)
exports.adminForceDeliver = async (req, res) => {
    try {
        const { orderId, sellerId } = req.body; // Admin ab Seller ID bhi bhejega

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: "Order Not Found." });

        // Filter: Is seller ke items dhoondo
        let sellerItems = order.items.filter(it => it.seller.toString() === sellerId.toString());
        if (sellerItems.length === 0) return res.status(404).json({ success: false, message: "Items Not Found." });

        // Check if already delivered
        if (sellerItems.every(it => it.status === "Delivered")) {
            return res.status(400).json({ success: false, message: "Items Already Delivered." });
        }

        // Status Update: Items ko "Delivered" mark karo
        sellerItems.forEach(item => {
            item.status = "Delivered";
            item.deliveryDetails = item.deliveryDetails || {};
            item.deliveryDetails.deliveredAt = new Date();
        });

        // Global Status check: Agar saare vendors deliver kar chuke hain
        const allDelivered = order.items.every(it => it.status === "Delivered");
        if (allDelivered) {
            order.orderStatus = "Delivered";
        }

        order.markModified('items');
        await order.save();

        // 🔥 TIMER START: Sirf is Seller ki transaction ka timer shuru karo
        const releaseDate = new Date();
        releaseDate.setDate(releaseDate.getDate() + 15);

        await Transaction.updateMany(
            { orderId: order._id, user: sellerId, type: "CREDIT", status: "ON_HOLD" },
            { $set: { releaseDate: releaseDate } }
        );

        res.json({ success: true, message: `Admin ne Seller (${sellerId}) ke items Force Deliver kar diye!` });
    } catch (err) { 
        res.status(500).json({ success: false, message: err.message }); 
    }
};

// 2. Force Refund (Jab Seller badmashi kare, Admin paisa user ko dila de)
exports.adminForceRefund = async (req, res) => {
    try {
        const { orderId, sellerId } = req.body;

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: "Order Not Found." });

        // Is seller ke items dhoondo
        let sellerItems = order.items.filter(it => it.seller.toString() === sellerId.toString());
        if (sellerItems.length === 0) return res.status(404).json({ success: false, message: "Seller Items Not Found." });

        let totalUserRefund = 0;
        let totalSellerDeduction = 0;

        // Loop through items for calculation & restock
        for (const item of order.items) {
            if (item.seller.toString() === sellerId.toString() && item.status !== "Returned" && item.status !== "Cancelled") {
                
                // 🔥 Effective Price (Discount handle karna)
                const effectivePrice = item.price - (item.price * (item.discount / 100));
                const itemFullPrice = Math.round(effectivePrice * item.quantity);
                const itemSeller90Share = Math.round(itemFullPrice * 0.90);

                totalUserRefund += itemFullPrice;
                totalSellerDeduction += itemSeller90Share;

                // Inventory Restock (Force refund hai toh mal wapas maana jayega)
                // Note: Agar Inventory model yahan required hai toh loop ke andar logic chalega
                await Inventory.findOneAndUpdate(
                    { product: item.itemId, seller: sellerId }, // itemId yahan Product ref hona chahiye
                    { $inc: { remaining: item.quantity, sold: -item.quantity } }
                );

                item.status = "Returned";
            }
        }

        if (totalUserRefund === 0) return res.status(400).json({ success: false, message: "Refundable items not Found." });

        // 1. Seller se 90% kaato (Pending balance se)
        await User.findByIdAndUpdate(sellerId, { $inc: { pendingBalance: -totalSellerDeduction } });

        // 2. User ko 100% do (Wallet balance mein)
        await User.findByIdAndUpdate(order.user, { $inc: { walletBalance: totalUserRefund } });

        // 3. Transaction Handling (Partial Refund logic)
        const sellerTxn = await Transaction.findOne({ orderId: order._id, user: sellerId, type: "CREDIT", status: "ON_HOLD" });
        if (sellerTxn) {
            const newAmount = sellerTxn.amount - totalSellerDeduction;
            if (newAmount <= 0) {
                sellerTxn.status = "CANCELLED";
                sellerTxn.amount = 0;
            } else {
                sellerTxn.amount = newAmount;
                sellerTxn.description += " (Admin Force Refunded)";
            }
            await sellerTxn.save();
        }

        // 4. Create Audit Log for User Refund
        await Transaction.create({
            user: order.user, 
            orderId: order._id, 
            amount: totalUserRefund,
            type: "CREDIT", 
            description: "Admin Force Refund Processed", 
            status: "SUCCESS", 
            paymentGateway: "WALLET"
        });

        // Global status update if necessary
        const allReturned = order.items.every(it => it.status === "Returned" || it.status === "Cancelled");
        if (allReturned) {
            order.orderStatus = "Returned";
        }

        order.markModified('items');
        await order.save();

        res.json({ success: true, message: "Force Refund By Admin" });
    } catch (err) { 
        console.error(err);
        res.status(500).json({ success: false, message: err.message }); 
    }
};