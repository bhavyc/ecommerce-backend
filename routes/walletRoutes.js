const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const walletController = require("../controllers/walletController");

router.get("/", protect, walletController.getWallet);
router.post("/add", protect, walletController.addMoney);

module.exports = router;