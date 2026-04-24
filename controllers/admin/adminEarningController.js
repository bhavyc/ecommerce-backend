const Order = require("../../models/Order");
const Transaction = require("../../models/Transaction");
const SlotBooking = require("../../models/SlotBooking"); // 🔥 Naya Model Import

exports.renderEarningPage = async (req, res) => {
    try {
        // 1. Orders Stats (Multi-vendor and Discount Aware)
        const orderStats = await Order.aggregate([
            { $match: { paymentStatus: "PAID" } },
            { $unwind: "$items" }, // Har item ko alag karo taaki item-level calculation ho sake
            {
                $group: {
                    _id: null,
                    // 🔥 FIX: Pehle "Effective Price" nikaalo aggregation ke andar
                    // Formula: (Price - (Price * Discount / 100)) * Quantity * 0.10
                    totalCommission: { 
                        $sum: { 
                            $multiply: [
                                { 
                                    $multiply: [
                                        { 
                                            $subtract: [ 
                                                "$items.price", 
                                                { $multiply: ["$items.price", { $divide: ["$items.discount", 100] }] } 
                                            ] 
                                        }, 
                                        "$items.quantity" 
                                    ] 
                                }, 
                                0.10 
                            ] 
                        } 
                    },
                    totalOrders: { $addToSet: "$_id" } // Unique Order IDs count karne ke liye
                }
            },
            {
                $project: {
                    totalCommission: 1,
                    totalOrdersCount: { $size: "$totalOrders" }
                }
            }
        ]);

        // 2. Slot Booking Stats (Drops/Deals fees) - No changes here
        const slotStats = await SlotBooking.aggregate([
            { $match: { status: "PAID" } },
            { $group: { _id: null, totalSlotRevenue: { $sum: "$amountPaid" } } }
        ]);

        // 3. Referral Expenses (Kharcha) - No changes here
        const referralExpense = await Transaction.aggregate([
            { $match: { description: { $regex: "Referral Bonus", $options: "i" }, status: "SUCCESS" } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);

        const stats = orderStats[0] || { totalCommission: 0, totalOrdersCount: 0 };
        const slotRevenue = slotStats[0]?.totalSlotRevenue || 0;
        const totalExpense = referralExpense[0]?.total || 0;

        // Total Gross = Commission (from all sellers on discounted price) + Slot Revenue
        const totalGross = stats.totalCommission + slotRevenue;
        const netProfit = totalGross - totalExpense;

        // Escrow Balance (Jo paisa abhi sellers ko milna baki hai)
        const escrowStats = await Transaction.aggregate([
            { $match: { status: "ON_HOLD", type: "CREDIT" } },
            { $group: { _id: null, totalHold: { $sum: "$amount" } } }
        ]);

        const escrowBalance = escrowStats[0]?.totalHold || 0;

        res.render("admin/earnings/view", { 
            user: req.user,
            stats: {
                totalCommission: stats.totalCommission,
                totalOrders: stats.totalOrdersCount
            },
            slotRevenue,
            totalExpense,
            netProfit,
            escrowBalance
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



