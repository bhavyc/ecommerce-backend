const fs = require("fs");
const csv = require("csv-parser");
const jwt = require("jsonwebtoken");
const Inventory = require("../../models/Inventory");
const Product = require("../../models/Product");
const NewDeal = require("../../models/NormalDeal");
const Order = require("../../models/Order");
const SellerProfile = require("../../models/SellerProfile");

// ==================== PRODUCT MANAGEMENT ====================

// Add Product
exports.addProductApi = async (req, res) => {
  try {
    const sellerId = req.user._id;
    const { title, description, price, image, discount } = req.body;

    if (!title || !price) {
      return res.status(400).json({ message: "Title and price are required." });
    }

    const product = new Product({
      seller: sellerId,
      title,
      description,
      price,
      image,
      discount: discount || 0,
    });

    await product.save();
    res.status(201).json({ message: "Product added successfully", product });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error while adding product" });
  }
};

// Update Product
exports.updateProductApi = async (req, res) => {
  try {
    const { title, description, price, discount, category } = req.body;
    const productId = req.params.id;

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    await Product.findByIdAndUpdate(productId, {
      title,
      description,
      price,
      discount,
      category
    });

    res.json({ message: "Product updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error while updating product" });
  }
};

// Delete Product
exports.deleteProductApi = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    await Product.findByIdAndDelete(productId);
    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error while deleting product" });
  }
};

// Toggle Featured
exports.toggleFeaturedApi = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    product.featured = !product.featured;
    await product.save();

    res.json({ message: "Product featured status updated", featured: product.featured });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error while toggling featured" });
  }
};

// ==================== INVENTORY MANAGEMENT ====================

// Add Stock
exports.addStockApi = async (req, res) => {
  try {
    const sellerId = req.user._id;
    const { productId, totalStock } = req.body;

    if (!productId || !totalStock || totalStock <= 0) {
      return res.status(400).json({ message: "Product ID and valid stock are required." });
    }

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found." });

    const existingInventory = await Inventory.findOne({ seller: sellerId, product: productId });
    if (existingInventory) {
      return res.status(400).json({ message: "Inventory already exists. Use restock." });
    }

    const inventory = new Inventory({
      seller: sellerId,
      product: product._id,
      totalStock,
      sold: 0,
      remaining: totalStock,
      restocks: []
    });
    await inventory.save();

    // Auto-add to NewDeals if not exist
    const existingDeal = await NewDeal.findOne({ product: product._id });
    if (!existingDeal && totalStock > 0) {
      const deal = new NewDeal({
        product: product._id,
        title: product.title,
        description: product.description,
        image: product.image,
        price: product.price,
        featured: product.featured || false
      });
      await deal.save();
    }

    res.status(201).json({ message: "Stock added successfully", inventory });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error while adding stock" });
  }
};

// View Stock with Pagination
exports.viewStockApi = async (req, res) => {
  try {
    const sellerId = req.user._id;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);

    const filter = { seller: sellerId };
    const [totalCount, inventory] = await Promise.all([
      Inventory.countDocuments(filter),
      Inventory.find(filter)
        .populate("product")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
    ]);

    res.json({
      inventory,
      pagination: {
        page,
        limit,
        totalPages: Math.max(Math.ceil(totalCount / limit), 1),
        totalCount,
        hasPrev: page > 1,
        hasNext: page < Math.ceil(totalCount / limit)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error while fetching inventory" });
  }
};

// Restock
exports.restockApi = async (req, res) => {
  try {
    const { quantity } = req.body;
    const inventoryId = req.params.id;

    const inventory = await Inventory.findById(inventoryId);
    if (!inventory) return res.status(404).json({ message: "Inventory not found" });

    inventory.totalStock += Number(quantity);
    inventory.remaining += Number(quantity);
    inventory.restocks.push({ quantity: Number(quantity) });

    await inventory.save();
    res.json({ message: "Inventory restocked successfully", inventory });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error while restocking" });
  }
};

// ==================== SELLER PROFILE ====================

// Submit Profile
exports.submitProfileFormApi = async (req, res) => {
  try {
    const sellerId = req.user._id;
    const existing = await SellerProfile.findOne({ seller: sellerId });
    if (existing) return res.status(400).json({ message: "Profile already submitted" });

    const profile = new SellerProfile({
      seller: sellerId,
      businessName: req.body.businessName,
      businessType: req.body.businessType,
      panNumber: req.body.panNumber,
      gstNumber: req.body.gstNumber,
      address: req.body.address,
      city: req.body.city,
      state: req.body.state,
      pincode: req.body.pincode,
      bankAccountNo: req.body.bankAccountNo,
      ifscCode: req.body.ifscCode
    });

    await profile.save();
    req.user.verificationStatus = "UNDER_REVIEW";
    await req.user.save();

    res.status(201).json({ message: "Profile submitted successfully", profile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error while submitting profile" });
  }
};

// ==================== DASHBOARD STATS ====================
exports.getSellerStatsApi = async (req, res) => {
  try {
    const sellerId = req.user._id;

    const totalProducts = await Product.countDocuments({ seller: sellerId });
    const totalOrders = await Order.countDocuments({ "items.seller": sellerId });
    const totalEarningsAgg = await Order.aggregate([
      { $match: { "items.seller": sellerId, paymentStatus: "PAID" } },
      { $unwind: "$items" },
      { $match: { "items.seller": sellerId } },
      { $group: { _id: null, total: { $sum: "$items.subtotal" } } }
    ]);
    const totalEarnings = totalEarningsAgg[0]?.total || 0;

    // Monthly sales (last 12 months)
    const monthlySalesAgg = await Order.aggregate([
      { $match: { "items.seller": sellerId, paymentStatus: "PAID" } },
      { $unwind: "$items" },
      { $match: { "items.seller": sellerId } },
      { $group: { _id: { $month: "$createdAt" }, total: { $sum: "$items.subtotal" } } },
      { $sort: { "_id": 1 } }
    ]);
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const salesData = new Array(12).fill(0);
    monthlySalesAgg.forEach(ms => salesData[ms._id - 1] = ms.total);

    res.json({
      totalProducts,
      totalOrders,
      totalEarnings,
      months,
      salesData
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error while fetching stats" });
  }
};

// ==================== BULK UPLOAD ====================
exports.bulkUploadApi = async (req, res) => {
  try {
    const filePath = req.file.path;
    const sellerId = req.user._id;

    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", async () => {
        for (const row of results) {
          await Product.create({
            seller: sellerId,
            title: row.title,
            description: row.description,
            category: row.category || "general",
            price: Number(row.price),
            discount: Number(row.discount || 0),
            image: row.image || "",
          });
        }
        fs.unlinkSync(filePath);
        res.status(201).json({ message: "Bulk upload completed successfully" });
      });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error while performing bulk upload" });
  }
};
