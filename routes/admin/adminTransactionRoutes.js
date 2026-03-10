
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/admin/adminTransactionController");
const { protect, isAdmin } = require("../../middleware/admin/adminMiddleware");

router.get("/", protect, isAdmin, ctrl.renderTransactionPage);
router.get("/data", protect, isAdmin, ctrl.getTransactionData);

module.exports = router;