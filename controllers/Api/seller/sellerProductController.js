// controllers/seller/productController.js
const Inventory = require("../../models/Inventory");
const Product = require("../../models/Product");
const Order = require("../../models/Order");
const NewDeal = require("../../models/NormalDeal");

// 1. Dashboard Stats
exports.getDashboardStats = async (req, res) => {
  try {
    const sellerId = req.user._id;

    // Fetch Products
    const products = await Product.find({ seller: sellerId });
    const totalProducts = products.length;
    const stockCount = products.reduce((sum, p) => sum + (p.stock || 0), 0); // Assuming stock is on Product model

    // Orders & Revenue
    const paidOrders = await Order.find({ "items.seller": sellerId, paymentStatus: "PAID" });
    const totalOrders = paidOrders.length;
    
    const revenue = paidOrders.reduce((sum, order) => {
      const subtotalSum = order.items
        ?.filter(i => i.seller?.toString() === sellerId.toString())
        .reduce((acc, item) => acc + (item.subtotal || 0), 0);
      return sum + subtotalSum;
    }, 0);

    // Charts Data: Top Selling
    const topProductsRaw = await Product.find({ seller: sellerId }).sort({ sold: -1 }).limit(5);
    const topProductNames = topProductsRaw.map(p => p.title);
    const topProductSales = topProductsRaw.map(p => p.sold);

    // Charts Data: Monthly Sales
    const currentYear = new Date().getFullYear();
    const revenueData = await Order.aggregate([
      { $match: { "items.seller": sellerId, paymentStatus: "PAID", createdAt: { $gte: new Date(`${currentYear}-01-01`) } } },
      { $unwind: "$items" },
      { $match: { "items.seller": sellerId } },
      {
        $group: {
          _id: { $month: "$createdAt" },
          total: { $sum: "$items.subtotal" }
        }
      }
    ]);

    const salesData = new Array(12).fill(0);
    revenueData.forEach(item => { salesData[item._id - 1] = item.total; });

    res.json({
      success: true,
      data: {
        totalProducts,
        stockCount,
        totalOrders,
        revenue,
        charts: {
          topProductNames,
          topProductSales,
          salesData
        }
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error fetching dashboard data" });
  }
};

// 2. Get Inventory (Paginated)
exports.getInventory = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const filter = { seller: req.user._id };

    const [totalCount, inventory] = await Promise.all([
      Inventory.countDocuments(filter),
      Inventory.find(filter)
        .populate("product")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
    ]);

    res.json({
      success: true,
      inventory,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// 3. Add Product
exports.addProduct = async (req, res) => {
  try {
    const sellerId = req.user._id;
    const { title, description, price, discount, category } = req.body;
    let imageUrl = "";
    
    if(req.file) imageUrl = "/uploads/" + req.file.filename;

    const product = new Product({
      seller: sellerId,
      title,
      description,
      price,
      discount: discount || 0,
      image: imageUrl,
      category
    });

    await product.save();
    res.status(201).json({ success: true, message: "Product created successfully", product });

  } catch (err) {
    res.status(500).json({ success: false, message: "Error adding product" });
  }
};

// 4. Add Stock (Initialize Inventory)
exports.addStock = async (req, res) => {
  try {
    const { productId, totalStock } = req.body;
    const sellerId = req.user._id;

    if (!productId || !totalStock || totalStock <= 0) {
      return res.status(400).json({ success: false, message: "Invalid Input" });
    }

    const exists = await Inventory.findOne({ seller: sellerId, product: productId });
    if (exists) return res.status(400).json({ success: false, message: "Inventory exists. Use Restock." });

    const inventory = new Inventory({
      seller: sellerId,
      product: productId,
      totalStock,
      remaining: totalStock,
      sold: 0
    });
    await inventory.save();

    res.status(201).json({ success: true, message: "Stock initialized", inventory });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error adding stock" });
  }
};

// 5. Restock
exports.restock = async (req, res) => {
  try {
    const { quantity } = req.body;
    const inventoryId = req.params.id;

    const inventory = await Inventory.findById(inventoryId);
    if (!inventory) return res.status(404).json({ success: false, message: "Inventory not found" });

    inventory.totalStock += Number(quantity);
    inventory.remaining += Number(quantity);
    inventory.restocks.push({ quantity: Number(quantity), date: new Date() });

    await inventory.save();
    res.json({ success: true, message: "Restocked successfully", inventory });
  } catch (err) {
    res.status(500).json({ success: false, message: "Restock error" });
  }
};