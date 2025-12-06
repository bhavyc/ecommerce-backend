const Order = require("../../models/Order");

// 📜 GET ORDER HISTORY
exports.getOrderHistory = async (req, res) => {
  try {
    const userId = req.user._id; // Retrieved from Auth Middleware

    // Fetch orders, sorted by newest first
    const orders = await Order.find({ user: userId })
      .sort({ createdAt: -1 });

    // Check if user has no orders
    if (!orders || orders.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No order history found",
        count: 0,
        orders: []
      });
    }

    res.status(200).json({
      success: true,
      count: orders.length,
      orders
    });

  } catch (error) {
    console.error("Order history error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Something went wrong fetching order history",
      error: error.message 
    });
  }
};