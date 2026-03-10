const SellerProfile = require("../../models/SellerProfile");
const SellerDocument = require("../../models/SellerDocument");
const User = require("../../models/User");
const SlotBooking = require("../../models/SlotBooking");
const Transaction = require("../../models/Transaction");
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
    if (!profile) return res.status(404).send("Seller profile not found");

    // 🔥 Important: Seller ki ID se documents nikalna
    const documents = await SellerDocument.find({ seller: profile.seller._id });
    
    console.log("Found Documents:", documents); // Console mein check karo data aa raha hai ya nahi

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


exports.getSellerMasterList = async (req, res) => {
  try {
    // --- 1. GLOBAL STATS (Cards ke liye) ---
    
    // Aaj ki taareekh (Subah 00:00 se)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // Aaj ka Slot Revenue (Drop + Deal fees)
    const todaySlotStats = await SlotBooking.aggregate([
      { $match: { status: "PAID", createdAt: { $gte: startOfDay } } },
      { $group: { _id: null, total: { $sum: "$amountPaid" } } }
    ]);
    const todaySlotRevenue = todaySlotStats[0] ? todaySlotStats[0].total : 0;

    // --- 2. SELLER LIST DATA (Loop logic) ---
    
    // Saare Sellers fetch karo
    const sellers = await User.find({ role: "seller" }).sort({ createdAt: -1 });

    // Har seller ka data calculate karo (Promise.all for speed)
    const sellerData = await Promise.all(sellers.map(async (seller) => {
      
      // A. Business Name (Profile se)
      const profile = await SellerProfile.findOne({ seller: seller._id }).select("businessName");

      // B. Total Slot Spend (VIP Score - Lifetime)
      const slotStats = await SlotBooking.aggregate([
        { $match: { seller: seller._id, status: "PAID" } },
        { $group: { _id: null, total: { $sum: "$amountPaid" } } }
      ]);
      const totalSlotSpend = slotStats[0] ? slotStats[0].total : 0;

      // C. Total Orders (Sales)
      // Hum Transaction table count karenge jahan seller ko CREDIT mila ho
      const orderCount = await Transaction.countDocuments({
        user: seller._id,
        type: "CREDIT",
        // SUCCESS = Paisa mil gaya, ON_HOLD = Pending Balance mein hai
        status: { $in: ["SUCCESS", "ON_HOLD"] } 
      });

      return {
        _id: seller._id,
        name: seller.name,
        email: seller.email,
        businessName: profile ? profile.businessName : "N/A",
        walletBalance: seller.walletBalance || 0,
        pendingBalance: seller.pendingBalance || 0,
        verificationStatus: seller.verificationStatus,
        
        // Calculated Fields
        slotSpend: totalSlotSpend, // Kitna kharch kiya slots par
        totalOrders: orderCount    // Kitne order beche
      };
    }));

    // --- 3. RENDER PAGE ---
    res.render("admin/seller/masterList", { 
      user: req.user,
      sellerData,
      todaySlotRevenue
    });

  } catch (err) {
    console.error("Master List Error:", err);
    res.status(500).send("Server Error");
  }
};