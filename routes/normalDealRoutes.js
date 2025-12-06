const express = require("express");
const router = express.Router();
const dealController = require("../controllers/normalDealController");
const {protect}= require("../middleware/authMiddleware");
// Routes
 
router.get("/", dealController.getDeals);
router.get("/featured", dealController.getFeaturedDeals);
router.get("/list",protect, dealController.renderDealsPage);

module.exports = router;
