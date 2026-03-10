const express = require("express");
const router = express.Router();
const multer = require("multer");
const sellerController = require("../../controllers/seller/sellerController");

// Dashboard
// router.get("/dashboard", sellerController.getDashboard);

// Product Management
router.get("/product/edit/:id", sellerController.renderEditProduct);
router.post("/product/edit/:id", sellerController.updateProduct);
router.get("/product/delete/:id", sellerController.deleteProduct);
router.post("/product/feature/:id", sellerController.toggleFeatured);

// Bulk CSV Upload
const upload = multer({ dest: "uploads/csv/" });
router.get("/products/bulk-upload", sellerController.renderBulkUpload);
router.post("/products/bulk-upload", upload.single("csvFile"), sellerController.bulkUpload);

module.exports = router;
