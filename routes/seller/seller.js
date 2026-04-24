const express = require("express");
const router = express.Router();
const multer = require("multer");
const sellerController = require("../../controllers/seller/sellerController");
const { authMiddleware, sellerMiddleware } = require("../../middleware/seller/authMiddleware");

//  1. CLOUDINARY STORAGE SETUP (For Images)
const { storage } = require("../../config/cloudinary"); 
const cloudinaryUpload = multer({ storage: storage }); // Iska naam badal diya taaki mix na ho

//  2. LOCAL STORAGE SETUP (For CSV Files)
const csvUpload = multer({ dest: "uploads/csv/" }); // Iska bhi naam badal diya

// --- Product Management ---
router.get("/product/edit/:id", sellerController.renderEditProduct);
router.post("/product/edit/:id", sellerController.updateProduct);
router.get("/product/delete/:id", sellerController.deleteProduct);
router.post("/product/feature/:id", sellerController.toggleFeatured);

// --- Orders & Labels ---
router.get("/orders/print-label/:orderId", authMiddleware, sellerMiddleware, sellerController.printShippingLabel);
router.get("/daily-orders", sellerController.getDailyOrders);
router.get("/daily-orders/download", sellerController.downloadDailyOrdersExcel);

// --- Bulk CSV Upload (Uses csvUpload) ---
router.get("/products/bulk-upload", sellerController.renderBulkUpload);
router.post("/products/bulk-upload", csvUpload.single("csvFile"), sellerController.bulkUpload);

// --- Dispatch Logic (Uses cloudinaryUpload) ---
// ✅ Yahan maine 'cloudinaryUpload' kar diya hai taaki photo Cloudinary par jaye
router.post("/order/dispatch", authMiddleware, sellerMiddleware, cloudinaryUpload.single('dispatchProof'), sellerController.dispatchOrder);

// --- Returns & Refunds ---
router.get("/returns", authMiddleware, sellerMiddleware, sellerController.getReturnsList);
 
router.post("/order/process-refund", authMiddleware, sellerMiddleware, sellerController.processRefund);

// routes/seller/seller.js
// Assign Pickup route ko update karo taaki ye image le sake
router.post("/order/assign-pickup", authMiddleware, sellerMiddleware, cloudinaryUpload.single('pickupProof'), sellerController.assignReturnPickup);

module.exports = router;