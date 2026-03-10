
module.exports.sellerActiveOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "seller") {
    return res.status(403).json({ message: "Seller only" });
  }
  if (!req.user.isSellerActive || req.user.verificationStatus !== "VERIFIED") {
    // If not active, keep them in onboarding
    return res.redirect("/seller/onboarding/review");
  }
  next();
};
