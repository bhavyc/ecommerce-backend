const User = require("../../models/User");
// const Drop = require("../models/FruitDrop"); 
// const WelcomeDrop = require("../models/WelcomeDrop"); 

// 🟢 BUY MEMBERSHIP
exports.buyMembership = async (req, res) => {
  try {
    const userId =  req.user ? (req.user.id || req.user._id || req.user.userId) : null; // Get ID from Auth Middleware
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // 1. Check if already a member
    const now = new Date();
    if (user.isMember && user.membershipExpiry > now) {
      return res.status(400).json({ 
        success: false, 
        message: "You are already a Premium Member",
        expiryDate: user.membershipExpiry
      });
    }

    // ---------------------------------------------------------
    // 💳 PAYMENT LOGIC GOES HERE 
    // In a real app, you would verify the payment status from 
    // Razorpay/Stripe before executing the code below.
    // ---------------------------------------------------------

    // 2. Activate Membership (30 Days)
    user.isMember = true;
    user.membershipExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await user.save();

    res.status(200).json({
      success: true,
      message: "Membership activated successfully!",
      user: {
        id: user._id,
        name: user.name,
        isMember: user.isMember,
        membershipExpiry: user.membershipExpiry
      }
    });

  } catch (err) {
    console.error("Membership Error:", err);
    res.status(500).json({ success: false, message: "Server error processing membership" });
  }
};

// 🔍 CHECK MEMBERSHIP STATUS
// Useful for the frontend to decide whether to show "Buy Premium" or "Premium Active"
exports.getMembershipStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const isMember = user.isMember && user.membershipExpiry > new Date();

    res.status(200).json({
      success: true,
      status: {
        isMember,
        expiryDate: isMember ? user.membershipExpiry : null,
        daysLeft: isMember ? Math.ceil((user.membershipExpiry - new Date()) / (1000 * 60 * 60 * 24)) : 0
      }
    });

  } catch (err) {
    console.error("Status Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};