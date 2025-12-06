const express = require("express");
const router = express.Router();
const dealController = require("../../controllers/admin/dealController");
const { generateDailyDeals, generateFreshDrop } = require("../../utils/automationEngine");
// ... existing imports

// 👇 Naya Route: "Refresh Deals Now" button ke liye
router.post("/auto-refresh", async (req, res) => {
  try {
    await generateDailyDeals(); // Purane delete, naye create
    await generateFreshDrop();  // Naya drop add
    res.redirect("/api/admin/deals"); // Wapas list par bhej do
  } catch (err) {
    res.send("Automation Failed: " + err.message);
  }
});

// Deals routes
router.get("/", dealController.listDeals);
router.get("/create", dealController.showCreateDeal);
router.post("/create", dealController.createDeal);

module.exports = router;
