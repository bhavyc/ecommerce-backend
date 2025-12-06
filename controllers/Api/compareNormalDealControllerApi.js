const CompareNormalDeal = require("../../models/compareNormalDeal");
const NormalDeal = require("../../models/NormalDeal");

// Helper to get ID safely
const getUserId = (req) => {
  return req.user ? (req.user.id || req.user._id || req.user.userId) : null;
};

// ---------------- GET COMPARE LIST ----------------
exports.getCompareList = async (req, res) => {
  try {
    const userId = getUserId(req); // ✅ FIX
    if (!userId) return res.status(401).json({ success: false, message: "User ID missing" });

    const compareList = await CompareNormalDeal.findOne({ user: userId }).populate("items.deal");

    if (!compareList) {
      return res.status(200).json({ success: true, items: [] });
    }

    res.status(200).json({
      success: true,
      items: compareList.items
    });

  } catch (err) {
    console.error("Get Compare Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ---------------- ADD TO COMPARE ----------------
exports.addToCompare = async (req, res) => {
  try {
    const userId = getUserId(req); // ✅ FIX
    if (!userId) return res.status(401).json({ success: false, message: "User ID missing" });

    const { dealId } = req.body;

    // 1. Validate Deal
    const deal = await NormalDeal.findById(dealId);
    if (!deal) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    // 2. Find or Create List
    let compareList = await CompareNormalDeal.findOne({ user: userId });
    if (!compareList) {
      compareList = new CompareNormalDeal({ user: userId, items: [] });
    }

    // 3. Check Limit (Max 4)
    if (compareList.items.length >= 4) {
      return res.status(400).json({ success: false, message: "Compare list full (Max 4 items)" });
    }

    // 4. Check Duplicate
    const isDuplicate = compareList.items.some(i => i.deal.toString() === dealId);
    if (isDuplicate) {
      return res.status(400).json({ success: false, message: "Item already in compare list" });
    }

    // 5. Add Item Snapshot
    compareList.items.push({
      deal: deal._id,
      title: deal.title,
      image: deal.image,
      price: deal.price,
      description: deal.description
    });

    await compareList.save();

    res.status(200).json({
      success: true,
      message: "Added to compare list",
      items: compareList.items
    });

  } catch (err) {
    console.error("Add Compare Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ---------------- REMOVE FROM COMPARE ----------------
exports.removeFromCompare = async (req, res) => {
  try {
    const userId = getUserId(req); // ✅ FIX
    const { id } = req.params; // dealId passed in URL

    const compareList = await CompareNormalDeal.findOne({ user: userId });
    if (!compareList) {
      return res.status(404).json({ success: false, message: "Compare list not found" });
    }

    compareList.items = compareList.items.filter(i => i.deal.toString() !== id);
    await compareList.save();

    res.status(200).json({ success: true, message: "Removed", items: compareList.items });

  } catch (err) {
    console.error("Remove Compare Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ---------------- CLEAR COMPARE LIST ----------------
exports.clearCompareList = async (req, res) => {
  try {
    const userId = getUserId(req); // ✅ FIX
    await CompareNormalDeal.findOneAndDelete({ user: userId });
    res.status(200).json({ success: true, message: "Compare list cleared", items: [] });
  } catch (err) {
    console.error("Clear Compare Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};