const jwt = require("jsonwebtoken");
const User = require("../../models/User");

// ---------------- AUTH MIDDLEWARE (Seller Only) ----------------
const authMiddleware = async (req,res,next) => {
  try {
    const token = req.cookies.sellerToken;
    if(!token) return res.redirect("/seller/auth/login");

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if(!user || user.role !== "seller") return res.redirect("/seller/auth/login");
    if(user.verificationStatus === "UNDER_REVIEW") return res.redirect("/seller/auth/under-review");
    if(user.verificationStatus === "REJECTED") return res.redirect("/seller/auth/register");

    req.user = user;
    next();
  } catch(err){
    console.error(err);
    res.redirect("/seller/auth/login");
  }
};

 
// ---------------- SELLER-ONLY MIDDLEWARE ----------------
const sellerMiddleware = (req, res, next) => {
  if (!req.user || req.user.role !== "seller") {
    
    return res.status(403).json({ message: "Access denied: Seller only" });
  }
  next();
};

// ---------------- BUYER-ONLY MIDDLEWARE (Not used here, but kept for structure) ----------------
const buyerMiddleware = (req, res, next) => {
  return res.status(403).json({ message: "This route is only for sellers" });
};

module.exports = { authMiddleware, sellerMiddleware, buyerMiddleware };

const protectSellerApi = async (req, res, next) => {
  try {
    // Check Cookie OR Authorization Header (Bearer token)
    let token = req.cookies.sellerToken;
    
    if (!token && req.headers.authorization) {
        token = req.headers.authorization.split(" ")[1];
    }

    // 1. No Token -> 401 Unauthorized
    if (!token) {
        return res.status(401).json({ success: false, message: "Unauthorized: Please login first" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    // 2. Invalid User -> 403 Forbidden
    if (!user || user.role !== "seller") {
        return res.status(403).json({ success: false, message: "Access denied: Sellers only" });
    }

    // 3. Status Checks -> 403 Forbidden with specific message
    if (user.verificationStatus === "UNDER_REVIEW") {
        return res.status(403).json({ success: false, message: "Account is under review" });
    }
    if (user.verificationStatus === "REJECTED") {
        return res.status(403).json({ success: false, message: "Account has been rejected" });
    }

    req.user = user;
    next();

  } catch (err) {
    console.error("API Auth Error:", err.message);
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};


const onboardingMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies.sellerToken;
    if (!token) return res.redirect("/seller/auth/login");

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || user.role !== "seller") return res.redirect("/seller/auth/login");

    // MAJOR CHANGE: Hum yahan "UNDER_REVIEW" ko allow kar rahe hain
    // Kyunki usse hi to KYC complete karni hai via DigiLocker
    
    if (user.verificationStatus === "REJECTED") {
        return res.redirect("/seller/auth/register"); 
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Onboarding Middleware Error:", err);
    res.redirect("/seller/auth/login");
  }
};

module.exports = { authMiddleware, sellerMiddleware, buyerMiddleware, onboardingMiddleware };
