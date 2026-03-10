const Deal = require("../../models/24HrDeal");
const NormalDeal = require("../../models/NormalDeal");

// Show create form
exports.showCreateDeal = async (req, res) => {
  try {
    const normalDeals = await NormalDeal.find().sort({ createdAt: -1 });
    res.render("admin/deals/create", { error: null, user: req.user, normalDeals });
  } catch (err) {
    res.render("admin/deals/create", { error: "Error fetching normal deals", user: req.user, normalDeals: [] });
  }
};

// Handle create deal
exports.createDeal = async (req, res) => {
  const { 
    title, description, image, price, discount, featured,
    // 🔥 New Fields for Group Buy
    isGroupBuyAvailable, groupPrice, groupSize 
  } = req.body;

  try {
    const deal = new Deal({
      title,
      description,
      image,
      price,
      discount: discount || 0,
      featured: featured === "on" ? true : false,

      // 🔥 Logic for Group Buy
      isGroupBuyAvailable: isGroupBuyAvailable === "on" ? true : false,
      groupPrice: groupPrice ? Number(groupPrice) : null,
      groupSize: groupSize ? Number(groupSize) : 2 // Default 2 people
    });

    await deal.save();
    res.redirect("/api/admin/deals");
  } catch (err) {
    console.error(err);
    // Error aane par wapas form dikhao
    const normalDeals = await NormalDeal.find().sort({ createdAt: -1 });
    res.render("admin/deals/create", { error: err.message, user: req.user, normalDeals });
  }
};

// List active deals
exports.listDeals = async (req, res) => {
  try {
    const deals = await Deal.find().sort({ createdAt: -1 });
    res.render("admin/deals/list", { deals, user: req.user });
  } catch (err) {
    console.error(err);
    res.send("Error fetching deals");
  }
};