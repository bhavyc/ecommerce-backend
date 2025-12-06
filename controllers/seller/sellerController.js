
const Inventory = require("../../models/Inventory");
const Product = require("../../models/Product");
const NewDeal = require("../../models/NormalDeal"); // ✅ replaced Deal with NewDeal
const Order = require("../../models/Order");
const jwt = require("jsonwebtoken");

// Add stock
exports.addStock = async (req, res) => {
  try {
    const { productId, totalStock } = req.body;
    const sellerId = req.user._id;

    // 1️⃣ Validate input
    if (!productId || !totalStock || totalStock <= 0) {
      return res.status(400).json({ message: "Product ID and valid stock are required." });
    }

    // 2️⃣ Find the product
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found." });

    // 3️⃣ Check if seller already has inventory for this product
    const existingInventory = await Inventory.findOne({ seller: sellerId, product: productId });
    if (existingInventory) {
      return res.status(400).json({
        message: "Inventory for this product already exists. Please use restock."
      });
    }

    // 4️⃣ Create new inventory entry
    const inventory = new Inventory({
      seller: sellerId,
      product: product._id,
      totalStock,
      sold: 0,
      remaining: totalStock,
      restocks: []
    });
    await inventory.save();

    // Add to NewDeals automatically (only if stock > 0)
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
      console.log("Product added as a NewDeal:", deal.title);
    }

    res.status(201).json({
      message: "Stock added successfully",
      inventory
    });
  } catch (err) {
    console.error("Add Stock Error:", err);
    res.status(500).json({ error: "Server error while adding stock." });
  }
};

// View stock
// exports.viewStock = async (req, res) => {
//   try {
//     const sellerId = req.user._id;

//     const inventory = await Inventory.find({ seller: sellerId }).populate("product");

//     res.render("seller/inventory", {
//       user: req.user,
//       inventory
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Server Error");
//   }
// };
// View  stock  (with pagination)

 


exports.viewStock =  async (req, res) => {
  try {
    const sellerId = req.user._id;

    // read ?page & ?limit, with safe fallbacks
    const page  = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100); // cap at 100

    const filter = { seller: sellerId };

    const [totalCount, inventory] = await Promise.all([
      Inventory.countDocuments(filter),
      Inventory.find(filter)
        .populate("product")
        .sort({ createdAt: -1 }) // requires timestamps on Inventory schema; remove/change if not present
        .skip((page - 1) * limit)
        .limit(limit)
    ]);
    
    const totalPages = Math.max(Math.ceil(totalCount / limit), 1);

    res.render("seller/inventory", {
      user: req.user,
      inventory,
      // pagination payload
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

// Render Restock Form (GET)
exports.renderRestockForm = async (req, res) => {
  try {
    const inventoryId = req.params.id;
    const inventory = await Inventory.findById(inventoryId).populate("product");
    if (!inventory) return res.status(404).send("Inventory not found");

    res.render("seller/restock", { user: req.user, inventory });
  } catch (err) {
    console.error("Error rendering restock form:", err);
    res.status(500).send("Server error");
  }
};

// Handle Restock Submission (POST)
exports.restock = async (req, res) => {
  try {
    const { quantity } = req.body;
    const inventoryId = req.params.id;

    const inventory = await Inventory.findById(inventoryId);
    if (!inventory) return res.status(404).send("Inventory not found");

    inventory.totalStock += Number(quantity);
    inventory.restocks.push({ quantity: Number(quantity) });
    inventory.remaining += Number(quantity);

    await inventory.save();

    res.redirect("/seller/inventory"); // redirect to inventory list after restock
  } catch (err) {
    console.error("Restock error:", err);
    res.status(500).send("Server error");
  }
};

exports.renderAddInventory = async (req, res) => {
  try {
    const sellerId = req.user._id;

    // 1️⃣ Sabhi products jo seller ne inventory me already add kiye
    const addedProductIds = await Inventory.find({ seller: sellerId }).distinct("product");

    // 2️⃣ Sirf wo products jo inventory me nahi hain
    const products = await Product.find({
      seller: sellerId,
      _id: { $nin: addedProductIds } // inventory me nahi hain
    });

    res.render("seller/addStock", { user: req.user, products });
  } catch (err) {
    console.error("Error rendering Add Inventory:", err);
    res.status(500).send("Server error while loading add inventory page.");
  }
};

exports.renderAddProduct = (req, res) => {
  res.render("seller/addProduct", { user: req.user });
};

exports.addProduct = async (req, res) => {
  try {
    const sellerId = req.user._id;
    const { title, description, price, image, discount } = req.body;

    const product = new Product({
      seller:sellerId,
      title,
      description,
      price,
      image,
      discount: discount || 0
    });

    await product.save();
    console.log("Product added:", product.title);

    res.redirect("/seller/inventory/add");
  } catch (err) {
    console.error("Add Product Error:", err);
    res.status(500).send("Server error while adding product.");
  }
};



// Seller Profiile Controller
// controllers/sellerProfileController.js
const SellerProfile = require("../../models/SellerProfile");

exports.renderProfileForm = async (req,res) => {
  res.render("seller/completeProfile", { user: req.user });
};

exports.submitProfileForm = async (req,res) => {
  try {
    const sellerId = req.user._id;
    const existing = await SellerProfile.findOne({ seller: sellerId });
    if(existing) return res.status(400).send("Profile already submitted");

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

    // Update User status → under_review
    req.user.verificationStatus = "UNDER_REVIEW";
    await req.user.save();

    res.redirect("/seller/documents/upload");
  } catch(err){
    console.error(err);
    res.status(500).send("Server error");
  }
};



exports.getSellerStats = async (req, res) => {
  try {
    const sellerId = req.user._id;

    // Summary cards
    const totalProducts = await Product.countDocuments({ seller: sellerId });
    const totalOrders = await Order.countDocuments({ seller: sellerId });
    const totalEarnings = await Order.aggregate([
      { $match: { seller: sellerId, status: "delivered" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    // Monthly sales chart
    const monthlySales = await Order.aggregate([
      { $match: { seller: sellerId } },
      { $group: { _id: { $month: "$createdAt" }, totalSales: { $sum: "$amount" } } },
      { $sort: { "_id": 1 } }
    ]);

    // Top 5 products
    const topProducts = await Order.aggregate([
      { $match: { seller: sellerId } },
      { $group: { _id: "$product", totalSold: { $sum: "$quantity" } } },
      { $sort: { totalSold: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: "$product" }
    ]);

    res.render("seller/dashboardStats", {
      totalProducts,
      totalOrders,
      totalEarnings: totalEarnings[0]?.total || 0,
      monthlySales,
      topProducts
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching dashboard stats");
  }
};


// Product Management
exports.renderEditProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  res.render("seller/editProduct", { product });
};

exports.updateProduct = async (req, res) => {
  const { title, description, price, discount, category } = req.body;
  await Product.findByIdAndUpdate(req.params.id, {
    title,
    description,
    price,
    discount,
    category
  });
  res.redirect("/seller/dashboard");
};

exports.deleteProduct = async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.redirect("/seller/dashboard");
};

exports.toggleFeatured = async (req, res) => {
  const product = await Product.findById(req.params.id);
  await Product.findByIdAndUpdate(req.params.id, { featured: !product.featured });
  res.redirect("/seller/dashboard");
};

// ======================== BULK UPLOAD ==========================
exports.renderBulkUpload = (req, res) => {
  res.render("seller/bulkUpload");
};

exports.bulkUpload = async (req, res) => {
  console.log("Hello")
  const filePath = req.file.path;
  const token = req.cookies.sellerToken;
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const sellerId = decoded.id;

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
      fs.unlinkSync(filePath); // clean up uploaded file
      res.redirect("/seller/dashboard");
    });
};