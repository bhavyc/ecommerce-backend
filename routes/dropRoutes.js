const express = require("express");
const router = express.Router();
const { protect,requireMembership} = require("../middleware/authMiddleware");
const dropController = require("../controllers/dropController");
 

// List all active drops
router.get("/", protect, dropController.listDrops);

// Show single drop details
router.get("/:id", protect, dropController.showDrop);

// Claim a drop
// router.post("/:id/claim", protect,requireMembership ,dropController.claimDrop);
 
module.exports = router; 
