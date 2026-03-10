const express = require("express");
const router = express.Router();
const qaController = require("../controllers/qaController");
const {protect} = require("../middleware/authMiddleware");

// Get Q&A for a product
router.get("/:productId",protect, qaController.getQA);

 
router.post("/:productId/question",protect,qaController.askQuestion);
router.post("/:productId/:questionId/answer",protect,qaController.answerQuestion);
module.exports = router;
