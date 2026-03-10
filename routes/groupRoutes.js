const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const groupBuyController = require("../controllers/groupBuyController");

// Start a group (POST form submission)
router.post("/start", protect, groupBuyController.startGroup);

// View Lobby (Shareable Link)
router.get("/lobby/:groupId", protect, groupBuyController.viewLobby);

// Join a group (POST form submission from Lobby)
router.post("/join", protect, groupBuyController.joinGroup);

module.exports = router;