const Deal = require("../models/24HrDeal");

// 🟢 List all active (non-expired) deals
exports.listActiveDeals = async (req, res) => {
  try {
    const deals = await Deal.find().sort({ createdAt: -1 });

    // calculate discountedPrice for each deal
    const dealsWithDiscount = deals.map(deal => {
      const discountedPrice = deal.discount
        ? deal.price - (deal.price * deal.discount) / 100
        : deal.price;
      return { ...deal.toObject(), discountedPrice };
    });

    res.render("deals/list", {
      deals: dealsWithDiscount,
      user: req.user || null,
    });
  } catch (err) {
    console.error(err);
    res.send("Error fetching deals");
  }
};

// 🟢 Claim a deal
// exports.claimDeal = async (req, res) => {
//   try {
//     if (!req.user) {
//       return res.status(401).send("Login required");
//     }

//     const deal = await Deal.findById(req.params.id);
//     if (!deal) {
//       return res.status(404).send("Deal not found");
//     }

//     const userId = req.user._id.toString();

     
//     const alreadyClaimed = deal.claimedBy.some(
//       (id) => id.toString() === userId
//     );
//     if (alreadyClaimed) {
//       return res.status(400).send("You have already claimed this deal");
//     }

//     // Add user to claimedBy
//     deal.claimedBy.push(req.user._id);
//     await deal.save();

//     res.redirect("/api/deals");
//   } catch (err) {
//     console.error("Error claiming deal:", err);
//     res.status(500).send("Error claiming deal");
//   }
// };
