const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");

router.get("/checkout/:userId", orderController.checkoutPage);
router.post("/place", orderController.placeOrder);
router.get("/user/:userId", orderController.getUserOrders);

// Razorpay Routes
router.post("/create-online-order", orderController.createOnlineOrder);
router.post("/verify-payment", orderController.verifyAndPlaceOrder);
// router.get("/:id", orderController.getOrderById);

module.exports = router;
