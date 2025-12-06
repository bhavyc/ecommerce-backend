const express = require("express");
const router = express.Router();
const NormalDeal = require("../models/NormalDeal");
const {
  showCompareList,
  addToCompare,
  removeFromCompare,
  clearCompareList
} = require("../controllers/compareNormalDealController");
const { protect } = require("../middleware/authMiddleware");
  // for login protection

router.get("/",protect, showCompareList);
router.get("/add/:id",protect, addToCompare);
router.get("/remove/:id",protect, removeFromCompare);
router.get("/clear", protect,clearCompareList);
router.get("/view", async (req, res) => {
  try {
    const ids = req.query.ids ? req.query.ids.split(",") : [];
 
    if (ids.length === 0) {
      return res.render("compare/view", { deals: [] });
    }

    const deals = await NormalDeal.find({ _id: { $in: ids } });
    res.render("compare/view", { deals });
  } catch (err) {
    console.error("Error loading comparison page:", err);
    res.status(500).send("Error loading comparison");
  }
});

module.exports = router;
