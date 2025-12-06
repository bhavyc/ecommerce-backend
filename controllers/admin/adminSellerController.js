const SellerProfile = require("../../models/SellerProfile");
const SellerDocument = require("../../models/SellerDocument");
const User = require("../../models/User");

// ✅ List all pending sellers
exports.listPendingSellers = async (req, res) => {
  try {
    const pendingSellers = await SellerProfile.find({ status: "under_review" }).populate("seller");
    res.render("admin/seller/pendingSellers", { pendingSellers });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};

// ✅ View seller details (profile + docs)
exports.viewSellerDetails = async (req, res) => {
  try {
    const profile = await SellerProfile.findById(req.params.id).populate("seller");
    if(!profile) return res.status(404).send("Seller not found");

    const documents = await SellerDocument.find({ seller: profile.seller._id });

    res.render("admin/seller/sellerDetails", { profile, documents });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};

// ✅ Approve seller
exports.approveSeller = async (req,res) => {
  try {
    const profile = await SellerProfile.findById(req.params.id);
    if(!profile) return res.status(404).send("Seller not found");

    profile.status = "approved";
    await profile.save();

    const user = await User.findById(profile.seller);
    user.verificationStatus = "APPROVED";
    await user.save();

    res.redirect("/api/admin/sellers/pending");
  } catch(err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};

// ✅ Reject seller
exports.rejectSeller = async (req, res) => {
  try {
    const profile = await SellerProfile.findById(req.params.id).populate("seller");
    if (!profile) return res.status(404).send("Seller not found");

    const sellerId = profile.seller._id;

    // 1️⃣ Delete all seller documents
    await SellerDocument.deleteMany({ seller: sellerId });

    // 2️⃣ Delete seller profile
    await SellerProfile.deleteOne({ _id: profile._id });

    // 3️⃣ Delete seller user
    await User.deleteOne({ _id: sellerId });

    console.log(`Seller ${profile.seller.email} and all related data deleted`);

    res.redirect("/api/admin/sellers/pending");
  } catch (err) {
    console.error("Reject Seller Error:", err);
    res.status(500).send("Server error while rejecting seller");
  }
};