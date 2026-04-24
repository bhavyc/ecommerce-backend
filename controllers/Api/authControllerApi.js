const User = require("../../models/User")
const jwt = require("jsonwebtoken");
const Order = require("../../models/Order");
const WelcomeDrop = require("../../models/WelcomeDrop");
const crypto = require("crypto");
const nodemailer = require("nodemailer"); 
const JWT_SECRET = process.env.JWT_SECRET || "token";
const Cart = require("../../models/Cart");
const Notification = require("../../models/Notification");
const Transaction = require("../../models/Transaction");

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
    const userId = req.user.id || req.user._id;

    // 1. Fetch user
    const user = await User.findById(userId).select("-password");

    // 2. PEHLE CHECK KARO KI USER HAI YA NAHI (Safety Check)
    if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
    }

    // 3. AUTOMATIC EXPIRY CHECK (Ab properties access karna safe hai)
    if (user.isMember && user.membershipExpiry && new Date() > new Date(user.membershipExpiry)) {
      user.isMember = false;
      await user.save(); 
      
    }

    // 4. Baki ka data fetch karo
    const orders = await Order.find({ user: userId }).sort({ placedAt: -1 });
    const welcomeDrops = await WelcomeDrop.find({});

    res.status(200).json({
      success: true,
      data: { user, orders, welcomeDrops }
    });

  } catch (err) {
    res.status(500).json({ success: false, message: "Error", error: err.message });
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



 

// 1. Transporter configuration
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    user.resetPasswordToken = otp;
    user.resetPasswordExpires = Date.now() + 600000; // 10 mins
    await user.save();

    // 🔥 2. REAL EMAIL SENDING LOGIC
    const mailOptions = {
      from: `"BharatMkt Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Password Reset OTP - BharatMkt",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee;">
          <h2 style="color: #000080;">BharatMkt Password Reset</h2>
          <p>Your 4-digit OTP for password reset is:</p>
          <h1 style="color: #FF9933; letter-spacing: 5px;">${otp}</h1>
          <p>This OTP is valid for 10 minutes only.</p>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    // Ab response mein OTP mat bhejna (Security!)
    res.json({ success: true, message: "OTP sent to your email!" });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error sending email" });
  }
};
// 2. RESET PASSWORD - Validate Token & Update
exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) return res.status(400).json({ success: false, message: "Invalid or expired token" });

    user.password = newPassword; // Pre-save hook will hash this automatically
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ success: true, message: "Password reset successful!" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};




// controllers/Api/authControllerApi.js mein ye function add kar:

exports.deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    // 1. User dhoondo
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // 2. User se juda saara data delete karo (Cleanup)
    await Cart.deleteMany({ user: userId });
    await Notification.deleteMany({ user: userId });
    await Transaction.deleteMany({ user: userId });
    // Note: Orders ko hum delete nahi karte legal reasons se, par account delete hone par wo user se unlink ho jate hain.

    // 3. Main User delete karo
    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: "Account and associated data deleted successfully."
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error deleting account", error: err.message });
  }
};




// controllers/Api/authControllerApi.js mein ye function add karo:

exports.updateProfile = async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.user.id || req.user._id;

    if (!name) return res.status(400).json({ success: false, message: "Name is required" });

    // User ko dhoondo aur uska naam update karo
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { name: name.trim() },
      { new: true } // Taaki update hone ke baad naya data return kare
    ).select("-password");

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};




// authControllerApi.js mein ye naya function add karo
exports.updateFcmToken = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { fcmToken } = req.body;

    if (!fcmToken) return res.status(400).json({ success: false, message: "Token missing" });

    await User.findByIdAndUpdate(userId, { fcmToken: fcmToken });
    
    res.status(200).json({ success: true, message: "FCM Token Updated" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};