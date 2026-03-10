const Expense = require("../models/Expense");

exports.dailyAnalytics = async (req, res) => {
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

    res.render("expense-analytics/daily", {
        pieLabels: Object.keys(categoryTotals),
        pieValues: Object.values(categoryTotals),
        lineLabels: Object.keys(hourlyTotals),
        lineValues: Object.values(hourlyTotals)
    });
};




exports.weeklyAnalytics = async (req, res) => {
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

    res.render("expense-analytics/weekly", {
        pieLabels: Object.keys(categoryTotals),
        pieValues: Object.values(categoryTotals),
        lineLabels: Object.keys(dailyTotals),
        lineValues: Object.values(dailyTotals)
    });
};



exports.yearlyAnalytics = async (req, res) => {
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

    res.render("expense-analytics/yearly", {
        pieLabels: Object.keys(categoryTotals),
        pieValues: Object.values(categoryTotals),
        lineLabels: Object.keys(monthTotals),
        lineValues: Object.values(monthTotals),
    });
};


exports.monthlyAnalytics = async (req, res) => {
    const userId = req.user._id;

    // Start of current month
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    // Current date
    const end = new Date();

    const expenses = await Expense.find({
        user: userId,
        expenseDate: { $gte: start, $lte: end }
    });

    const categoryTotals = {};
    const dayTotals = {};

    expenses.forEach(exp => {
        // Category totals for pie chart
        categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;

        // Day wise line chart
        const day = exp.expenseDate.getDate(); // 1,2,3,...30
        dayTotals[day] = (dayTotals[day] || 0) + exp.amount;
    });

    res.render("expense-analytics/monthly", {
        pieLabels: Object.keys(categoryTotals),
        pieValues: Object.values(categoryTotals),
        lineLabels: Object.keys(dayTotals),   // Days of the month
        lineValues: Object.values(dayTotals)
    });
};
