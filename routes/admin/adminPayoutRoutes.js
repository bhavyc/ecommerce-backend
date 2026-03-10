const express = require("express");
const router = express.Router();
const adminPayoutController = require("../../controllers/admin/adminPayoutController");





// 1. Page Dikhane ke liye (Browser URL: /admin/payouts)
router.get("/", adminPayoutController.renderPayoutsPage);

// 2. Data Fetch karne ke liye (API: Table fill karne ke liye)
router.get("/requests", adminPayoutController.getAllPayoutRequests);

// 3. Action lene ke liye (API: Approve/Reject button)
router.post("/process", adminPayoutController.processPayout);
module.exports = router;