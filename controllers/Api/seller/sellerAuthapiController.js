// controllers/seller/sellerApiController.js
const User = require("../../models/User");
const SellerProfile = require("../../models/SellerProfile");
const SellerDocument = require("../../models/SellerDocument");
const Inventory = require("../../models/Inventory");
const Product = require("../../models/Product");
const Order = require("../../models/Order");
const NormalDeal = require("../../models/NormalDeal");
const Deal24Hr = require("../../models/24HrDeal");
const Drop = require("../../models/FruitDrop");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

// ---------------- Multer Setup ----------------
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const email = req.body.email || "unknown_seller";
      const folderName = email.replace(/[@.]/g, "_");
      const sellerDir = path.join("uploads", "sellers", folderName);

      if (!fs.existsSync(sellerDir)) fs.mkdirSync(sellerDir, { recursive: true });
      cb(null, sellerDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const sanitized = file.originalname.replace(/\s+/g, "_");
    cb(null, `${timestamp}_${sanitized}`);
  }
});

const upload = multer({ storage });

// ---------------- REGISTER API ----------------
// POST /api/seller/register
exports.register = [
  upload.fields([
    { name: "panDoc", maxCount: 1 },
    { name: "gstDoc", maxCount: 1 },
    { name: "bankDoc", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const {
        name, email, password, businessName, businessType,
        panNumber, gstNumber, address, city, state, pincode,
        bankAccountNo, ifscCode
      } = req.body;

      const existing = await User.findOne({ email });
      if (existing) return res.status(400).json({ error: "Email already registered" });

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = new User({ name, email, password: hashedPassword, role: "seller", verificationStatus: "UNDER_REVIEW" });
      await user.save();

      const profile = new SellerProfile({
        seller: user._id,
        businessName,
        businessType,
        panNumber,
        gstNumber,
        address,
        city,
        state,
        pincode,
        bankAccountNo,
        ifscCode,
        status: "under_review"
      });
      await profile.save();

      // Save uploaded documents
      const files = req.files;
      if (files.panDoc) await new SellerDocument({ seller: user._id, docType: "PAN", filePath: files.panDoc[0].path }).save();
      if (files.gstDoc) await new SellerDocument({ seller: user._id, docType: "GST", filePath: files.gstDoc[0].path }).save();
      if (files.bankDoc) await new SellerDocument({ seller: user._id, docType: "Bank", filePath: files.bankDoc[0].path }).save();

      res.status(201).json({ message: "Seller registered successfully", userId: user._id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error during registration" });
    }
  }
];

// ---------------- LOGIN API ----------------
// POST /api/seller/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const seller = await User.findOne({ email, role: "seller" });
    if (!seller) return res.status(404).json({ error: "Seller not found." });

    if (seller.verificationStatus === "UNDER_REVIEW") return res.status(403).json({ error: "Your registration is under review." });
    if (seller.verificationStatus === "REJECTED") return res.status(403).json({ error: "Your registration was rejected. Please register again." });

    const isMatch = await bcrypt.compare(password, seller.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid password" });

    const token = jwt.sign({ id: seller._id, role: seller.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.cookie("sellerToken", token, { httpOnly: true, maxAge: 7*24*60*60*1000 });
    res.json({ message: "Login successful", token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error during login" });
  }
};

// ---------------- LOGOUT API ----------------
// POST /api/seller/logout
exports.logout = (req, res) => {
  res.clearCookie("sellerToken");
  res.json({ message: "Logged out successfully" });
};

// ---------------- DASHBOARD API ----------------
// GET /api/seller/dashboard
exports.getDashboard = async (req, res) => {
  try {
    const token = req.cookies.sellerToken || req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.role !== "seller") return res.status(401).json({ error: "Unauthorized" });

    // Pagination
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const filter = { seller: user._id };

    const [totalCount, inventory] = await Promise.all([
      Inventory.countDocuments(filter),
      Inventory.find(filter).populate("product").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
    ]);

    const totalPages = Math.max(Math.ceil(totalCount / limit), 1);
    const hasPrev = page > 1;
    const hasNext = page < totalPages;

    // Dashboard summaries
    const totalProducts = await Product.countDocuments({ seller: user._id });
    const allInventories = await Inventory.find({ seller: user._id });
    const totalStock = allInventories.reduce((sum, inv) => sum + (inv.totalStock || 0), 0);
    const soldStock = allInventories.reduce((sum, inv) => sum + (inv.sold || 0), 0);
    const remainingStock = allInventories.reduce((sum, inv) => sum + (inv.remaining || 0), 0);

    const totalOrders = await Order.countDocuments({ "items.seller": user._id });
    const paidOrders = await Order.find({ "items.seller": user._id, paymentStatus: "PAID" });
    const revenue = paidOrders.reduce((sum, order) => {
      const subtotalSum = order.items?.filter(i => i.seller.toString() === user._id.toString()).reduce((acc, i) => acc + (i.subtotal || 0), 0);
      return sum + subtotalSum;
    }, 0);

    const lowStock = await Inventory.find({ seller: user._id, remaining: { $lt: 5 } }).populate("product");
    const [normalDeals, timedDeals, dropDeals] = await Promise.all([
      NormalDeal.countDocuments({ seller: user._id }),
      Deal24Hr.countDocuments({ seller: user._id }),
      Drop.countDocuments({ seller: user._id })
    ]);

    // Monthly sales
    const monthlySalesAgg = await Order.aggregate([
      { $match: { "items.seller": user._id, paymentStatus: "PAID" } },
      { $unwind: "$items" },
      { $match: { "items.seller": user._id } },
      { $group: { _id: { $month: "$createdAt" }, total: { $sum: "$items.subtotal" } } },
      { $sort: { "_id": 1 } }
    ]);
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const salesData = new Array(12).fill(0);
    monthlySalesAgg.forEach(ms => { salesData[ms._id - 1] = ms.total; });

    // Top products
    const topProductsAgg = await Order.aggregate([
      { $match: { "items.seller": user._id, paymentStatus: "PAID" } },
      { $unwind: "$items" },
      { $match: { "items.seller": user._id } },
      { $group: { _id: "$items.product", totalSold: { $sum: "$items.quantity" } } },
      { $sort: { totalSold: -1 } },
      { $limit: 5 },
      { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "product" } },
      { $unwind: "$product" },
      { $project: { name: "$product.title", totalSold: 1 } }
    ]);
    const topProductNames = topProductsAgg.map(p => p.name);
    const topProductSales = topProductsAgg.map(p => p.totalSold);

    res.json({
      user,
      inventory,
      page,
      limit,
      totalPages,
      totalCount,
      hasPrev,
      hasNext,
      totalProducts,
      stockCount: totalStock,
      soldStock,
      remainingStock,
      totalOrders,
      revenue,
      lowStock,
      normalDeals,
      timedDeals,
      dropDeals,
      months,
      salesData,
      topProductNames,
      topProductSales
    });
  } catch (err) {
    console.error("Dashboard Error:", err.message);
    res.status(500).json({ error: "Server error fetching dashboard" });
  }
};
