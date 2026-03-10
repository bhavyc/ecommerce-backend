const fs = require("fs"); 
const csv = require("csv-parser");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

// Models Imports
const Inventory = require("../../models/Inventory");
const Product = require("../../models/Product");
const NormalDeal = require("../../models/NormalDeal"); // ✅ Fixed naming consistency
const Deal24Hr = require("../../models/24HrDeal"); 
const Drop = require("../../models/FruitDrop");
const Order = require("../../models/Order");
const User = require("../../models/User");
const Transaction = require("../../models/Transaction");
const SellerProfile = require("../../models/SellerProfile");

// ======================== DASHBOARD & STATS ==========================

// Main Dashboard Logic
exports.getSellerDashboard = async (req, res) => {
  try {
    const sellerId = new mongoose.Types.ObjectId(req.user._id);

    // 1. Basic Stats from Inventory
    const allInventory = await Inventory.find({ seller: sellerId }).populate("product");
    const totalProducts = allInventory.length;
    let stockCount = 0;
    let soldCount = 0;
    
    allInventory.forEach(inv => {
      stockCount += (inv.remaining || 0);
      soldCount += (inv.sold || 0);
    });

    // 2. Revenue & Orders Aggregation
    const currentYear = new Date().getFullYear();
    const revenueData = await Order.aggregate([
      { 
        $match: { 
          "items.seller": sellerId,
          paymentStatus: "PAID",
          createdAt: { 
            $gte: new Date(`${currentYear}-01-01`), 
            $lte: new Date(`${currentYear}-12-31`) 
          } 
        } 
      },
      { $unwind: "$items" },
      { $match: { "items.seller": sellerId } },
      {
        $group: {
          _id: { $month: "$createdAt" }, 
          monthlyRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
          count: { $sum: 1 } 
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const salesData = new Array(12).fill(0);
    let totalRevenue = 0;
    let totalOrdersCount = 0;

    revenueData.forEach(item => {
      salesData[item._id - 1] = item.monthlyRevenue;
      totalRevenue += item.monthlyRevenue;
      totalOrdersCount += item.count;
    });

    // 3. Deals Counters
    const [normalDealsCount, timedDealsCount, dropDealsCount] = await Promise.all([
      NormalDeal.countDocuments({ seller: sellerId }),
      Deal24Hr.countDocuments({ seller: sellerId }),
      Drop.countDocuments({ seller: sellerId }),
    ]);
    
    const lowStock = allInventory.filter(inv => inv.remaining < 5);

    res.render('seller/dashboard', {
      user: req.user,
      revenue: totalRevenue.toFixed(2),
      totalOrders: totalOrdersCount,
      totalProducts,
      stockCount,
      months,
      salesData,
      topProductNames: allInventory.sort((a,b) => b.sold - a.sold).slice(0,5).map(i => i.product?.title || "N/A"),
      topProductSales: allInventory.sort((a,b) => b.sold - a.sold).slice(0,5).map(i => i.sold),
      inventory: allInventory,
      lowStock,
      normalDeals: normalDealsCount,
      timedDeals: timedDealsCount,
      dropDeals: dropDealsCount
    });

  } catch (err) {
    console.error("Dashboard Error:", err);
    res.status(500).send("Server Error: Check Backend Console");
  }
};

// ======================== STOCK MANAGEMENT ==========================

exports.addStock = async (req, res) => {
  try {
    const { productId, totalStock } = req.body;
    const sellerId = req.user._id;

    if (!productId || !totalStock || totalStock <= 0) {
      return res.status(400).json({ message: "Product ID and valid stock are required." });
    }

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found." });

    const existingInventory = await Inventory.findOne({ seller: sellerId, product: productId });
    if (existingInventory) {
      return res.status(400).json({ message: "Inventory for this product already exists. Please use restock." });
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

    // Add to NormalDeals automatically (only if stock > 0)
    const existingDeal = await NormalDeal.findOne({ product: product._id });
    if (!existingDeal && totalStock > 0) {
      const deal = new NormalDeal({
        product: product._id,
        seller: sellerId, // ✅ Important for Dashboard tracking
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
    console.error("Add Stock Error:", err);
    res.status(500).json({ error: "Server error while adding stock." });
  }
};

exports.viewStock = async (req, res) => {
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
    
    const totalPages = Math.max(Math.ceil(totalCount / limit), 1);

    res.render("seller/inventory", {
      user: req.user,
      inventory,
      page,
      limit,
      totalPages,
      totalCount,
      hasPrev: page > 1,
      hasNext: page < totalPages
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

exports.restock = async (req, res) => {
  try {
    const { quantity } = req.body;
    const inventory = await Inventory.findById(req.params.id);
    if (!inventory) return res.status(404).send("Inventory not found");

    inventory.totalStock += Number(quantity);
    inventory.restocks.push({ quantity: Number(quantity) });
    inventory.remaining += Number(quantity);
    await inventory.save();

    res.redirect("/seller/inventory");
  } catch (err) {
    console.error("Restock error:", err);
    res.status(500).send("Server error");
  }
};

// ======================== PRODUCT MANAGEMENT ==========================

exports.addProduct = async (req, res) => {
  try {
    const sellerId = req.user._id;
    const { title, description, price, discount, category } = req.body;
    const imageUrl = req.file ? req.file.path : "";

    if (!imageUrl) return res.status(400).send("Add Image Of Product");

    const product = new Product({
      seller: sellerId,
      title,
      description,
      category: category || "General",
      price,
      image: imageUrl,
      discount: discount || 0
    });

    await product.save();
    res.redirect("/seller/inventory/add");
  } catch (err) {
    console.error("Add Product Error:", err);
    res.status(500).send("Server error while adding product.");
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { title, description, price, discount, category } = req.body;
    await Product.findByIdAndUpdate(req.params.id, {
      title, description, price, discount, category
    });
    res.redirect("/seller/dashboard");
  } catch (err) {
    res.status(500).send("Update failed");
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.redirect("/seller/dashboard");
  } catch (err) {
    res.status(500).send("Delete failed");
  }
};

// ======================== WALLET & FINANCE ==========================

exports.getWallet = async (req, res) => {
  try {
    const seller = await User.findById(req.user._id);
    if (!seller) return res.status(404).json({ success: false, message: "User not found" });

    res.status(200).json({
      success: true,
      walletBalance: seller.walletBalance || 0,
      pendingBalance: seller.pendingBalance || 0
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.renderWalletPage = async (req, res) => {
  res.render("seller/wallet", { user: req.user, path: '/seller/wallet' });
};

// ======================== ORDERS ==========================

exports.getDailyOrders = async (req, res) => {
  try {
    const sellerId = req.user._id;
    let selectedDate = req.query.date || new Date().toISOString().split('T')[0];

    const start = new Date(selectedDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(selectedDate);
    end.setHours(23, 59, 59, 999);

    const orders = await Order.find({
      "items.seller": sellerId,
      paymentStatus: "PAID",
      createdAt: { $gte: start, $lte: end }
    }).populate("user", "name email").sort({ createdAt: -1 });

    const processedOrders = orders.map(order => {
      const myItems = order.items.filter(it => it.seller.toString() === sellerId.toString());
      return {
        _id: order._id,
        customerName: order.shippingAddress.fullName || (order.user ? order.user.name : "N/A"),
        phone: order.shippingAddress.phone || "N/A",
        address: `${order.shippingAddress.addressLine1}, ${order.shippingAddress.city}`,
        items: myItems,
        grandTotal: myItems.reduce((sum, i) => sum + (i.price * i.quantity), 0),
        status: order.orderStatus,
        time: new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
    });

    res.render("seller/dailyOrders", { user: req.user, orders: processedOrders, selectedDate });
  } catch (err) {
    console.error("Daily Orders Error:", err);
    res.status(500).send("Error loading orders");
  }
};

// ======================== BULK UPLOAD ==========================

exports.bulkUpload = async (req, res) => {
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
            category: row.category || "General",
            price: Number(row.price),
            discount: Number(row.discount || 0),
            image: row.image || "",
          });
        }
        fs.unlinkSync(filePath); 
        res.redirect("/seller/dashboard");
      });
  } catch (err) {
    res.status(500).send("Bulk Upload Failed");
  }
};

// ======================== RENDERS ==========================

exports.renderAddInventory = async (req, res) => {
  try {
    const sellerId = req.user._id;
    const addedProductIds = await Inventory.find({ seller: sellerId }).distinct("product");
    const products = await Product.find({ seller: sellerId, _id: { $nin: addedProductIds } });
    res.render("seller/addStock", { user: req.user, products });
  } catch (err) {
    res.status(500).send("Server error");
  }
};

exports.renderAddProduct = (req, res) => { res.render("seller/addProduct", { user: req.user }); };
exports.renderRestockForm = async (req, res) => {
  const inventory = await Inventory.findById(req.params.id).populate("product");
  res.render("seller/restock", { user: req.user, inventory });
};
exports.renderBulkUpload = (req, res) => { res.render("seller/bulkUpload"); };
exports.renderEditProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  res.render("seller/editProduct", { product });
};

// Profile renders
exports.renderProfileForm = async (req,res) => { res.render("seller/completeProfile", { user: req.user }); };
exports.submitProfileForm = async (req,res) => {
  try {
    const sellerId = req.user._id;
    const profile = new SellerProfile({
      seller: sellerId,
      ...req.body
    });
    await profile.save();
    req.user.verificationStatus = "UNDER_REVIEW";
    await req.user.save();
    res.redirect("/seller/documents/upload");
  } catch(err){
    res.status(500).send("Profile submission failed");
  }
};

exports.toggleFeatured = async (req, res) => {
  const product = await Product.findById(req.params.id);
  await Product.findByIdAndUpdate(req.params.id, { featured: !product.featured });
  res.redirect("/seller/dashboard");
};