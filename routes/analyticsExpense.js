// routes/analyticsExpense.js
const express = require("express");
const router = express.Router();
const {protect} = require("../middleware/authMiddleware"); // your existing auth middleware
const {dailyAnalytics, weeklyAnalytics, monthlyAnalytics, yearlyAnalytics} = require("../controllers/expenseAnalyticsController");

router.get("/daily",protect, dailyAnalytics);
router.get("/weekly",protect, weeklyAnalytics);
router.get("/monthly", protect,monthlyAnalytics);
router.get("/yearly", protect,yearlyAnalytics);

module.exports = router;
