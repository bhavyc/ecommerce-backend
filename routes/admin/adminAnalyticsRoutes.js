const express = require("express");
const router = express.Router();

 
const analyticsController = require("../../controllers/admin/analytics");

// Middleware (agar admin auth hai)
const { isAdmin ,protect} = require("../../middleware/admin/adminMiddleware");
 
// Analytics
router.get("/analytics",analyticsController.getAnalytics);

module.exports = router;
