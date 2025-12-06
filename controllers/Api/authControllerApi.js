const User = require("../../models/User")
const jwt = require("jsonwebtoken");
const Order = require("../../models/Order");
const WelcomeDrop = require("../../models/WelcomeDrop");

const JWT_SECRET = process.env.JWT_SECRET || "token";

// Generate JWT Helper
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// ---------------- HANDLE REGISTER API ----------------
// Helper to generate random code (e.g., FRUIT8392)
const generateReferralCode = (name) => {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return (name.substring(0, 4).toUpperCase() + randomNum).replace(/\s/g, "");
};

exports.register = async (req, res) => {
  const { name, email, password, referralCode } = req.body; // referralCode frontend se aayega

  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ success: false, message: "Email already exists" });

    // 1. Find Referrer (Agar code dala hai)
    let referrerId = null;
    if (referralCode) {
      const referrer = await User.findOne({ referralCode });
      if (referrer) {
        referrerId = referrer._id;
      }
    }

    // 2. Create User
    user = new User({
      name,
      email,
      password,
      role: "user",
      referralCode: generateReferralCode(name), // Apna code generate karo
      referredBy: referrerId // Link karo
    });

    await user.save();
    
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
// ---------------- HANDLE LOGIN API ----------------
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user with role 'user'
    const user = await User.findOne({ email, role: "user" });
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid credentials" 
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid credentials" 
      });
    }

    // Generate Token
    const token = generateToken(user);

    // Option: Set cookie (good for web apps)
    res.cookie("userToken", token, { 
      httpOnly: true, 
      maxAge: 7 * 24 * 60 * 60 * 1000 
    });

    // Return JSON (good for mobile apps/React/Angular)
    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: err.message 
    });
  }
};

// ---------------- GET PROFILE API ----------------
exports.getProfile = async (req, res) => {
  try {
    // req.user comes from the middleware (see below)
    const userId = req.user.id || req.user._id;

    // Fetch user details (excluding password)
    const user = await User.findById(userId).select("-password");
    if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
    }

    // Fetch user's past orders
    const orders = await Order.find({ user: userId }).sort({ placedAt: -1 });
    
    // Fetch welcome drops
    const welcomeDrops = await WelcomeDrop.find({});

    res.status(200).json({
      success: true,
      data: {
        user,
        orders,
        welcomeDrops
      }
    });

  } catch (err) {
    console.error("Profile Error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching profile", 
      error: err.message 
    });
  }
};

// ---------------- LOGOUT API ----------------
exports.logout = (req, res) => {
  // Clear cookie
  res.clearCookie("userToken");
  
  res.status(200).json({ 
    success: true, 
    message: "Logged out successfully" 
  });
};