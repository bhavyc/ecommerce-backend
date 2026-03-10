const User = require("../models/User");
const jwt = require("jsonwebtoken");
// const Claim = require("../models/Claim");
const Drop = require("../models/FruitDrop");
const Deal = require("../models/24HrDeal");
const WelcomeDrop = require("../models/WelcomeDrop");
const JWT_SECRET = process.env.JWT_SECRET || "token";
const Order = require("../models/Order");
// Generate JWT
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// ---------------- RENDER REGISTER PAGE ----------------
exports.showRegister = (req, res) => {
  res.render("auth/register", { error: null });
};

// ---------------- HANDLE REGISTER ----------------
exports.register = async (req, res) => {
  const { name, email, password } = req.body;
  try {
    let user = await User.findOne({ email });
    if (user) return res.render("auth/register", { error: "Email already exists" });

    user = new User({ name, email, password, role: "user" });
    await user.save();
    res.redirect("login");
  } catch (err) {
    res.render("auth/register", { error: err.message });
  }
};

// ---------------- RENDER LOGIN PAGE ----------------
exports.showLogin = (req, res) => {
  res.render("auth/login", { error: null });
};

// ---------------- HANDLE LOGIN ----------------
exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email, role: "user" });
    if (!user) return res.render("auth/login", { error: "Invalid credentials" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.render("auth/login", { error: "Invalid credentials" });

    const token = generateToken(user);

    // Save user token separately
    res.cookie("userToken", token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });

    res.redirect("profile");
  } catch (err) {
    res.render("auth/login", { error: err.message });
  }
};

// ---------------- GET PROFILE ----------------
// exports.getProfile = async (req, res) => {
//   try {
//     const claims = await Claim.find({ user: req.user._id })
//       .populate("drop")
//       .sort({ claimedAt: -1 });
//     const claimedDrops = claims.filter(c => c.drop);

//     const purchasedDeals = await Deal.find({ claimedBy: req.user._id }).sort({ createdAt: -1 });

//     const welcomeDrops = await WelcomeDrop.find({});

//     res.render("auth/profile", {
//       user: req.user,
//       claimedDrops,
//       purchasedDeals,
//       welcomeDrops
//     });
//   } catch (err) {
//     console.error("Error fetching profile:", err);
//     res.send("Error loading profile: " + err.message);
//   }
// };
exports.getProfile = async (req, res) => {
  try {
    // Fetch user's past orders instead of claims
    const orders = await Order.find({ user: req.user._id }).sort({ placedAt: -1 });
    const welcomeDrops = await WelcomeDrop.find({});

    res.render("auth/profile", {
      user: req.user,
      orders, // Pass orders to the view
      welcomeDrops
    });
  } catch (err) {
    console.error("Error fetching profile:", err);
    res.send("Error loading profile: " + err.message);
  }
};


 
// ---------------- LOGOUT ----------------
exports.logout = (req, res) => {
  res.clearCookie("userToken");
  res.redirect("/auth/login");
};
