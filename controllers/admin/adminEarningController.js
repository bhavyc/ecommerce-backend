const Order = require("../../models/Order");
const Transaction = require("../../models/Transaction");
const SlotBooking = require("../../models/SlotBooking"); // 🔥 Naya Model Import

exports.renderEarningPage = async (req, res) => {
    try {
        // 1. Orders Stats (Commission + Delivery)
        const orderStats = await Order.aggregate([
            { $match: { paymentStatus: "PAID" } },
            {
                $group: {
                    _id: null,
                    totalCommission: { $sum: { $multiply: ["$subtotal", 0.10] } },
                    totalDelivery: { $sum: "$deliveryFee" },
                    totalOrders: { $sum: 1 }
                }
            }
        ]);

        // 2. Slot Booking Stats (Drops/Deals fees)
        const slotStats = await SlotBooking.aggregate([
            { $match: { status: "PAID" } },
            { $group: { _id: null, totalSlotRevenue: { $sum: "$amountPaid" } } }
        ]);

        // 3. Referral Expenses (Kharcha)
        const referralExpense = await Transaction.aggregate([
            { $match: { description: { $regex: "Referral Bonus", $options: "i" }, status: "SUCCESS" } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);

        const stats = orderStats[0] || { totalCommission: 0, totalDelivery: 0, totalOrders: 0 };
        const slotRevenue = slotStats[0]?.totalSlotRevenue || 0;
        const totalExpense = referralExpense[0]?.total || 0;

        // 🔥 ASLI CALCULATION
        // Total Kamayi = Commission + Delivery + Slots
        // Net Profit = Total Kamayi - Referral Expense
        const totalGross = stats.totalCommission + stats.totalDelivery + slotRevenue;
        const netProfit = totalGross - totalExpense;

        res.render("admin/earnings/view", { 
            user: req.user,
            stats,
            slotRevenue,
            totalExpense,
            netProfit
        });
    } catch (err) {
        res.status(500).send(err.message);
    }
};


// controllers/admin/adminEarningController.js

exports.getEarningData = async (req, res) => {
    try {
        const currentYear = new Date().getFullYear();

        // 1. Orders se kamayi (Commission + Delivery)
        const orderMonthly = await Order.aggregate([
            { 
                $match: { 
                    paymentStatus: "PAID",
                    createdAt: { $gte: new Date(`${currentYear}-01-01`), $lte: new Date(`${currentYear}-12-31`) }
                } 
            },
            {
                $group: {
                    _id: { $month: "$createdAt" },
                    total: { $sum: { $add: [{ $multiply: ["$subtotal", 0.10] }, "$deliveryFee"] } }
                }
            }
        ]);

        // 2. Slot Booking se kamayi
        const slotMonthly = await SlotBooking.aggregate([
            { 
                $match: { 
                    status: "PAID",
                    createdAt: { $gte: new Date(`${currentYear}-01-01`), $lte: new Date(`${currentYear}-12-31`) }
                } 
            },
            {
                $group: {
                    _id: { $month: "$createdAt" },
                    total: { $sum: "$amountPaid" }
                }
            }
        ]);

        // 3. Dono data ko merge karke 12 mahino ka array banana
        const monthlyFinal = new Array(12).fill(0);

        orderMonthly.forEach(item => {
            monthlyFinal[item._id - 1] += item.total;
        });

        slotMonthly.forEach(item => {
            monthlyFinal[item._id - 1] += item.total;
        });

        res.json({ success: true, monthlyFinal });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
};