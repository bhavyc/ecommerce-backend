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
    console.log("🚫 Seller access denied");
    return res.status(403).json({ message: "Access denied: Seller only" });
  }
  next();
};

// ---------------- BUYER-ONLY MIDDLEWARE (Not used here, but kept for structure) ----------------
const buyerMiddleware = (req, res, next) => {
  return res.status(403).json({ message: "This route is only for sellers" });
};

module.exports = { authMiddleware, sellerMiddleware, buyerMiddleware };