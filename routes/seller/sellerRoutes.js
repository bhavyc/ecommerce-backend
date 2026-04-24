const express = require("express");
const router = express.Router();
const sellerController = require("../../controllers/seller/sellerController");
const { authMiddleware, sellerMiddleware } = require("../../middleware/seller/authMiddleware");

// routes/seller/sellerRoutes.js

const multer = require("multer");
const { storage } = require("../../config/cloudinary"); // ✅ Cloudinary storage use karenge
const upload = multer({ storage: storage }); // Multer ko config de di

// POST: Add Product route ko update karo
router.post(
  "/add", 
  authMiddleware, 
  sellerMiddleware, 
  upload.single("image"), // 🔥 'image' input field ka naam hai
  sellerController.addProduct
);

//  Render Add Inventory Form (GET)
router.get("/inventory/add", authMiddleware, sellerMiddleware, sellerController.renderAddInventory);

// Add stock (POST)
router.post("/inventory/add", authMiddleware, sellerMiddleware, sellerController.addStock);


//  View inventory list (GET)
router.get("/inventory", authMiddleware, sellerMiddleware, sellerController.viewStock);


//  Restock
// Render Restock Form
router.get("/inventory/restock/:id", authMiddleware, sellerMiddleware, sellerController.renderRestockForm);

// Handle Restock Submission
router.post("/inventory/restock/:id", authMiddleware, sellerMiddleware, sellerController.restock);



// Seller Dashboard
router.get("/dashboard", authMiddleware, sellerMiddleware, sellerController.getSellerDashboard);

router.get("/add", authMiddleware, sellerMiddleware, sellerController.renderAddProduct);

// Add Product (POST)
router.post("/add", authMiddleware, sellerMiddleware, sellerController.addProduct);

router.get("/wallet", authMiddleware, sellerMiddleware, sellerController.renderWalletPage);
 
// Is line ko routes file mein add kar
router.get("/orders/print-label/:orderId", sellerController.printShippingLabel);
// routes/seller/sellerRoutes.js mein add karo
router.get("/daily-orders", authMiddleware, sellerMiddleware, sellerController.getDailyOrders);
module.exports = router;
