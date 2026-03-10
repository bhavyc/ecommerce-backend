const express = require("express");
const router = express.Router();
const {protect} = require("../middleware/authMiddleware");
const orderController = require("../controllers/orderHistoryController");

router.get("/history",protect, orderController.getOrderHistory);

module.exports = router;
