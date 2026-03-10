const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");
 
const membershipController = require("../controllers/membershipController");

// POST route to buy membership
router.post("/buy", protect, membershipController.buyMembership);

module.exports = router;


module.exports = router;
