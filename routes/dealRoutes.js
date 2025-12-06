const express = require("express");
const router = express.Router();
const userDealController = require("../controllers/dealController");
const {protect}= require("../middleware/authMiddleware")
// Show all active deals
router.get("/deals",protect, userDealController.listActiveDeals);

// Claim a deal
// router.post("/deals/:id/claim",protect, userDealController.claimDeal);

module.exports = router;
