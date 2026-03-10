const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cartController");

router.post("/add", cartController.addToCart);
router.get("/:userId", cartController.getCart);
router.post("/remove", cartController.removeItem);
router.get("/clear/:userId", cartController.clearCart);

module.exports = router;
