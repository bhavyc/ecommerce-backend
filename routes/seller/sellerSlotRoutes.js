const express = require("express");
const router = express.Router();

// Tumhara fixed middleware import karo
const { authMiddleware, protectSellerApi } = require("../../middleware/seller/authMiddleware"); // Path check karlena
const slotController = require("../../controllers/seller/sellerSlotController");

// ... (Baki purane routes yahan honge) ...

// ================= SLOT BOOKING ROUTES =================

// 1. Page Render (Use authMiddleware -> Redirects if fail)
router.get("/buy-slot", authMiddleware, slotController.renderSlotPage);

// 2. Create Order (Use protectSellerApi -> JSON error if fail)
router.post("/buy-slot/create-order",authMiddleware, slotController.createSlotOrder);

// 3. Verify Payment (Use protectSellerApi -> JSON error if fail)
router.post("/buy-slot/verify", authMiddleware, slotController.verifySlotPayment);
// routes/seller/sellerSlotRoutes.js
router.get("/slots/history", authMiddleware, slotController.renderSlotHistoryPage);
router.get("/slots/data", authMiddleware, slotController.getSellerSlotData);
module.exports = router;