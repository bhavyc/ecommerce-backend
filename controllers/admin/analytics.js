const Drop = require("../../models/FruitDrop");
const mongoose = require("mongoose");

// Admin Analytics
 exports.getAnalytics = async (req, res) => {
  try {
    const drops = await Drop.find().populate("claimedBy", "_id");

    if (!drops || drops.length === 0) {
      return res.render("admin/analytics/index", {
        mostClaimed: null,
        leastClaimed: null,
        chartData: [],
        totalRevenue: 0,
        user: req.user,
      });
    }

    let mostClaimed = null;
    let leastClaimed = null;

    drops.forEach((drop) => {
      if (!mostClaimed || drop.claimedBy.length > mostClaimed.claimedBy.length) {
        mostClaimed = drop;
      }
      if (!leastClaimed || drop.claimedBy.length < leastClaimed.claimedBy.length) {
        leastClaimed = drop;
      }
    });

    const chartData = drops.map((drop) => ({
      title: drop.title,
      claims: drop.claimedBy.length,
      startTime: drop.startTime,
    }));

    let totalRevenue = 0;
    drops.forEach((drop) => {
      const discountedPrice =
        drop.discount > 0
          ? drop.price - (drop.price * drop.discount) / 100
          : drop.price;

      totalRevenue += discountedPrice * drop.claimedBy.length;
    });

    res.render("admin/analytics/index", {
      mostClaimed,
      leastClaimed,
      chartData: JSON.stringify(chartData),
      totalRevenue,
      user: req.user,
    });
  } catch (err) {
    console.error(err);
    res.send("Error loading analytics");
  }
};
