const express = require("express");
const router = express.Router();
const adminDropController = require("../../controllers/admin/dropController");
const adminController = require("../../controllers/admin/authController");

// Protect all routes
router.use(adminController.protect);

// Show all drops (admin dashboard view)
router.get("/", adminDropController.listDrops);

// Show create drop form
router.get("/create", adminDropController.showCreateDrop);

// Handle create drop form
router.post("/create", adminDropController.createDrop);

module.exports = router;
