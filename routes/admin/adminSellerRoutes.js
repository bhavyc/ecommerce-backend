const express = require("express");
const router = express.Router();
const adminSellerController = require("../../controllers/admin/adminSellerController");
const { protect,isAdmin } = require("../../middleware/admin/adminMiddleware"); // Admin auth

// List pending sellers
router.get("/pending",protect,isAdmin,adminSellerController.listPendingSellers);

// View seller details
router.get("/view/:id",protect,isAdmin, adminSellerController.viewSellerDetails);

// Approve seller
router.post("/approve/:id",protect,isAdmin,adminSellerController.approveSeller);

// Reject seller
router.post("/reject/:id",protect,isAdmin,adminSellerController.rejectSeller);

router.get("/master-list", protect, adminSellerController.getSellerMasterList);

module.exports = router;
