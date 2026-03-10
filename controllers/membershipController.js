// // controllers/membershipController.js

const User = require("../models/User");
const Drop = require("../models/FruitDrop"); // Admin ke drops ka model
const WelcomeDrop = require("../models/WelcomeDrop"); // Hamara naya model

// Buy membership
exports.buyMembership = async (req, res) => {
  try {


    console.log("🔥 POST /membership/buy route hit!");
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).send("User not found");

    if (user.isMember && user.membershipExpiry > new Date()) {
      return res.redirect("/drops");
    }

    user.isMember = true;
    user.membershipExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // timedDropStart wali line yahan se HATA DI GAYI HAI

    await user.save();
    res.redirect("/drops");
  } catch (err) {
    // ... error handling
  }
};
