const CompareNormalDeal = require("../models/compareNormalDeal");
const NormalDeal = require("../models/NormalDeal");

exports.showCompareList = async (req, res) => {
  try {
    const userId = req.user._id;
    const compareList = await CompareNormalDeal.findOne({ user: userId }).populate("items.deal");

    if (!compareList || compareList.items.length === 0) {
      return res.render("compare/empty", { title: "Compare Deals" });
    }

    res.render("compare/list", {
      title: "Compare Normal Deals",
      items: compareList.items
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

exports.addToCompare = async (req, res) => {
  try {
    const userId = req.user._id;
    const dealId = req.params.id;

    const deal = await NormalDeal.findById(dealId);
    if (!deal) return res.status(404).send("Normal Deal not found");

    let compareList = await CompareNormalDeal.findOne({ user: userId });
    if (!compareList) compareList = new CompareNormalDeal({ user: userId, items: [] });

    // 🔒 Optional: Limit to 3 items
    if (compareList.items.length >= 3)
      return res.redirect("/compare?limitExceeded=true");

    // 🚫 Prevent duplicate
    if (compareList.items.some(i => i.deal.toString() === dealId)) {
      return res.redirect("/compare?alreadyAdded=true");
    }

    // ✅ Add snapshot
    compareList.items.push({
      deal: deal._id,
      title: deal.title,
      image: deal.image,
      price: deal.price,
      description: deal.description,
      featured: deal.featured
    });

    await compareList.save();
    res.redirect("/compare");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

exports.removeFromCompare = async (req, res) => {
  try {
    const userId = req.user._id;
    const dealId = req.params.id;

    const compareList = await CompareNormalDeal.findOne({ user: userId });
    if (!compareList) return res.redirect("/compare");

    compareList.items = compareList.items.filter(i => i.deal.toString() !== dealId);
    await compareList.save();

    res.redirect("/compare");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

exports.clearCompareList = async (req, res) => {
  try {
    const userId = req.user._id;
    await CompareNormalDeal.findOneAndDelete({ user: userId });
    res.redirect("/compare");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};
