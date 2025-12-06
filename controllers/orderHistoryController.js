const Order = require("../models/Order");

exports.getOrderHistory = async (req, res) => {
  try {
    const userId = req.user._id;

    const orders = await Order.find({ user: userId })
      .sort({ createdAt: -1 }); // latest first

    return res.render("orderHistory/order-history", {
      orders,
      user: req.user
    });

  } catch (error) {
    console.log("Order history error:", error);
    return res.status(500).send("Something went wrong");
  }
};
