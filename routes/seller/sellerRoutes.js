const express = require("express");
const router = express.Router();
const sellerController = require("../../controllers/seller/sellerController");
const { authMiddleware, sellerMiddleware } = require("../../middleware/seller/authMiddleware");



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




router.get("/add", authMiddleware, sellerMiddleware, sellerController.renderAddProduct);

// Add Product (POST)
router.post("/add", authMiddleware, sellerMiddleware, sellerController.addProduct);

 
module.exports = router;
