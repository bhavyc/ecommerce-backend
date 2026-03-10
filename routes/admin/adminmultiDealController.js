const express = require("express");
const router = express.Router();
const adminController = require("../../controllers/admin/multi-dealController");

// Routes
router.get("/", adminController.renderAddForm);
router.post("/add-multi-deal", adminController.addMultiDeal);

module.exports = router;
