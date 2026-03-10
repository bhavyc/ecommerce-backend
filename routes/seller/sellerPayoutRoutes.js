// routes/seller/sellerPayoutRoutes.js
const express = require("express");
const router = express.Router();
const payoutController = require("../../controllers/seller/payoutController");
const { authMiddleware } = require("../../middleware/seller/authMiddleware");

// All routes here are protected by authMiddleware

// GET: /seller/payouts/balance
router.get("/balance", authMiddleware, payoutController.getWalletData);

// POST: /seller/payouts/request
router.post("/request", authMiddleware, payoutController.requestPayout);

// GET: /seller/payouts/history
router.get("/history", authMiddleware, payoutController.getPayoutHistory);

module.exports = router;