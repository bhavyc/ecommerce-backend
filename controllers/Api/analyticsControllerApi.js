const Expense = require("../models/Expense");

// ---------------- DAILY ANALYTICS ----------------
exports.dailyAnalytics = async (req, res) => {
    try {
        const userId = req.user._id;

        const start = new Date();
        start.setHours(0, 0, 0, 0);

        const end = new Date();
        end.setHours(23, 59, 59, 999);

        const expenses = await Expense.find({
            user: userId,
            expenseDate: { $gte: start, $lte: end }
        });

        const categoryTotals = {};
        const hourlyTotals = {};

        expenses.forEach(exp => {
            categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;

            const hour = exp.expenseDate.getHours();
            hourlyTotals[hour] = (hourlyTotals[hour] || 0) + exp.amount;
        });

        res.status(200).json({
            success: true,
            timeFrame: "daily",
            pie: { labels: Object.keys(categoryTotals), values: Object.values(categoryTotals) },
            line: { labels: Object.keys(hourlyTotals), values: Object.values(hourlyTotals) }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ---------------- WEEKLY ANALYTICS ----------------
exports.weeklyAnalytics = async (req, res) => {
    try {
        const userId = req.user._id;

        const start = new Date();
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);

        const end = new Date();

        const expenses = await Expense.find({
            user: userId,
            expenseDate: { $gte: start, $lte: end }
        });

        const categoryTotals = {};
        const dailyTotals = {};

        expenses.forEach(exp => {
            categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;

            const day = exp.expenseDate.toDateString();
            dailyTotals[day] = (dailyTotals[day] || 0) + exp.amount;
        });

        res.status(200).json({
            success: true,
            timeFrame: "weekly",
            pie: { labels: Object.keys(categoryTotals), values: Object.values(categoryTotals) },
            line: { labels: Object.keys(dailyTotals), values: Object.values(dailyTotals) }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ---------------- MONTHLY ANALYTICS ----------------
exports.monthlyAnalytics = async (req, res) => {
    try {
        const userId = req.user._id;

        const start = new Date();
        start.setDate(1);
        start.setHours(0, 0, 0, 0);

        const end = new Date();

        const expenses = await Expense.find({
            user: userId,
            expenseDate: { $gte: start, $lte: end }
        });

        const categoryTotals = {};
        const dayTotals = {};

        expenses.forEach(exp => {
            categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;

            const day = exp.expenseDate.getDate(); // 1,2,3,...
            dayTotals[day] = (dayTotals[day] || 0) + exp.amount;
        });

        res.status(200).json({
            success: true,
            timeFrame: "monthly",
            pie: { labels: Object.keys(categoryTotals), values: Object.values(categoryTotals) },
            line: { labels: Object.keys(dayTotals), values: Object.values(dayTotals) }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ---------------- YEARLY ANALYTICS ----------------
exports.yearlyAnalytics = async (req, res) => {
    try {
        const userId = req.user._id;

        const start = new Date(new Date().getFullYear(), 0, 1);
        const end = new Date();

        const expenses = await Expense.find({
            user: userId,
            expenseDate: { $gte: start, $lte: end }
        });

        const categoryTotals = {};
        const monthTotals = {};

        expenses.forEach(exp => {
            categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;

            const month = exp.expenseDate.toLocaleString('default', { month: 'short' });
            monthTotals[month] = (monthTotals[month] || 0) + exp.amount;
        });

        res.status(200).json({
            success: true,
            timeFrame: "yearly",
            pie: { labels: Object.keys(categoryTotals), values: Object.values(categoryTotals) },
            line: { labels: Object.keys(monthTotals), values: Object.values(monthTotals) }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
};
