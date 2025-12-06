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
const Drop = require("../../models/FruitDrop");
const mongoose = require("mongoose");

// Admin Analytics
 exports.getAnalytics = async (req, res) => {
  try {
    const drops = await Drop.find().populate("claimedBy", "_id");

    if (!drops || drops.length === 0) {
      return res.render("admin/analytics/index", {
        mostClaimed: null,
        leastClaimed: null,
        chartData: [],
        totalRevenue: 0,
        user: req.user,
      });
    }

    let mostClaimed = null;
    let leastClaimed = null;

    drops.forEach((drop) => {
      if (!mostClaimed || drop.claimedBy.length > mostClaimed.claimedBy.length) {
        mostClaimed = drop;
      }
      if (!leastClaimed || drop.claimedBy.length < leastClaimed.claimedBy.length) {
        leastClaimed = drop;
      }
    });

    const chartData = drops.map((drop) => ({
      title: drop.title,
      claims: drop.claimedBy.length,
      startTime: drop.startTime,
    }));

    let totalRevenue = 0;
    drops.forEach((drop) => {
      const discountedPrice =
        drop.discount > 0
          ? drop.price - (drop.price * drop.discount) / 100
          : drop.price;

      totalRevenue += discountedPrice * drop.claimedBy.length;
    });

    res.render("admin/analytics/index", {
      mostClaimed,
      leastClaimed,
      chartData: JSON.stringify(chartData),
      totalRevenue,
      user: req.user,
    });
  } catch (err) {
    console.error(err);
    res.send("Error loading analytics");
  }
};
const User = require("../../models/User");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "token";

// Generate JWT
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role, name : user.name },
    JWT_SECRET,
    { expiresIn: "1d" }
  );
};

//  ADMIN LOGIN  

// Render admin login page
exports.showLogin = (req, res) => {
  res.render("admin/login", { error: null });
};

 
exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email, role: "admin" });
    if (!user) return res.render("admin/login", { error: "Invalid credentials" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.render("admin/login", { error: "Invalid credentials" });

    const token = generateToken(user);
   res.cookie("adminToken", token, {
  httpOnly: true,
  path: "/",         // make it available to all routes
  sameSite: "lax",   // allow browser to send cookie with requests
  secure: false,     // false for localhost
  maxAge: 24*60*60*1000
});

    res.redirect("/admin/dashboard");
  } catch (err) {
    res.render("admin/login", { error: err.message });
  }
};

//   ADMIN PROTECT MIDDLEWARE  
exports.protect = (req, res, next) => {
  const token = req.cookies.adminToken;
  if (!token) return res.redirect("/admin/login");

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "admin") return res.redirect("/api/admin/login");

    req.user = decoded;
    next();
  } catch (err) {
    console.error("JWT Error:", err);
    return res.redirect("/admin/login");
  }
};



//   ADMIN DASHBOARD  
exports.dashboard = async (req, res) => {
  try {
    res.render("admin/dashboard", { user: req.user });
  } catch (err) {
    console.error("Dashboard Error:", err);
    res.send("Error loading dashboard");
  }
};



//   ADMIN REGISTRATION  
exports.showRegister = (req, res) => {
  res.render("admin/register", { error: null });
};

exports.register = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // Check if any admin exists
    const existingAdmin = await User.findOne({ role: "admin" });

    // If admins exist, require current user to be logged-in admin
    if (existingAdmin) {
      if (!req.user || req.user.role !== "admin") {
        return res.send("Unauthorized");
      }
    }

    // Check if email is already taken
    let user = await User.findOne({ email });
    if (user) return res.render("admin/register", { error: "Email already exists" });

    // Create new admin
    user = new User({ name, email, password, role: "admin", isMember: true });
    await user.save();

    // Redirect to admin login
    res.redirect("/api/admin/login");
  } catch (err) {
    console.error("Admin Registration Error:", err);
    res.render("admin/register", { error: err.message });
  }
};

//   ADMIN LOGOUT  
exports.logout = (req, res) => {
  res.clearCookie("adminToken");
  res.redirect("/admin/login");
};




// =========================
//   VIEW ALL SELLERS
// =========================
exports.viewSellers = async (req, res) => {
  try {
    const sellers = await User.find({ role: "seller" }).select("name email createdAt");
    res.render("admin/seller/seller", { user: req.user, sellers });
  } catch (err) {
    console.error("Error fetching sellers:", err);
    res.send("Error loading sellers list");
  }
};

// =========================
//   DELETE SELLER
// =========================
exports.deleteSeller = async (req, res) => {
  try {
    const { id } = req.params;
    const seller = await User.findById(id);

    if (!seller || seller.role !== "seller") {
      return res.status(404).send("Seller not found");
    }

    await User.findByIdAndDelete(id);
    res.redirect("/admin/sellers");
  } catch (err) {
    console.error("Error deleting seller:", err);
    res.status(500).send("Error deleting seller");
  }
};


exports.getSellers = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 10; // 10 sellers per page

    const query = { role: "seller" };
    if (search) {
      query.name = { $regex: search, $options: "i" }; // case-insensitive search
    }

    const totalSellers = await User.countDocuments(query);
    const totalPages = Math.ceil(totalSellers / limit);

    const sellers = await User.find(query)
      .sort({ createdAt: -1 }) // newest first
      .skip((page - 1) * limit)
      .limit(limit);

    res.render("admin/seller/seller", {
      sellers,
      search,
      currentPage: page,
      totalPages
    });
  } catch (err) {
    console.error("Error fetching sellers:", err);
    res.send("Error fetching sellers");
  }
};
const Deal = require("../../models/24HrDeal");

// Show create 24hr deal form
exports.showCreateDeal = (req, res) => {
  res.render("admin/deals/create", { error: null, user: req.user });
};

// Handle create 24hr deal
exports.createDeal = async (req, res) => {
  const { title, description, image, price, discount, featured } = req.body;

  try {
    const start = new Date();
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000); // 24 hours later

    const deal = new Deal({
      title,
      description,
      image,
     
      price,
      discount: discount || 0,
      featured: featured === "on" ? true : false,
    });

    await deal.save();
    res.redirect("/api/admin/deals");
  } catch (err) {
    console.error(err);
    res.render("admin/deals/create", { error: err.message, user: req.user });
  }
};

// List active deals
exports.listDeals = async (req, res) => {
  try {
    const now = new Date();
    const deals = await Deal.find({
      
    }).sort({ createdAt: -1 });

    res.render("admin/deals/list", { deals, user: req.user });
  } catch (err) {
    console.error(err);
    res.send("Error fetching deals");
  }
};
 
const Drop = require("../../models/FruitDrop");

// List all drops
exports.listDrops = async (req, res) => {
  try {
    const drops = await Drop.find().sort({ startTime: -1 });
    res.render("admin/drops/list", { drops, user: req.user });
  } catch (err) {
    console.error(err);
    res.send("Error fetching drops");
  }
};

// Show create drop form
exports.showCreateDrop = (req, res) => {
  res.render("admin/drops/create", { error: null, user: req.user });
};
 

// ... (listDrops, showCreateDrop waise hi rahenge) ...

// Handle create drop form
exports.createDrop = async (req, res) => {
  // startTime aur endTime ko req.body se nikaal diya hai
  const { title, description, image, price, featured, discount } = req.body;

  try {
    const drop = new Drop({
      title,
      description,
      image,
      // startTime aur endTime yahan se bhi hata diye gaye hain
      price,
      discount: discount || 0,
      featured: featured === "on" ? true : false,
    });

    await drop.save();
    res.redirect("/api/admin/drops");
  } catch (err) {
    console.error(err);
    res.render("admin/drops/create", { error: err.message, user: req.user });
  }
};
const NewDeal = require("../../models/NormalDeal");
const Drop = require("../../models/FruitDrop");
const Deal = require("../../models/24HrDeal");

// GET: Render form
exports.renderAddForm = (req, res) => {
  res.render("admin/multi-deal/addDeal");
};

// POST: Save data to selected models
exports.addMultiDeal = async (req, res) => {
  try {
    const { title, description, image, price, discount, startTime, endTime, collections } = req.body;

    if (!collections) return res.status(400).send("Please select at least one model.");
    if (!image) return res.status(400).send("Image URL is required.");

    const data = {
      title,
      description,
      image,
      price,
      discount: discount || 0,
      startTime: startTime || new Date(),
      endTime: endTime || new Date(),
    };

    const selected = Array.isArray(collections) ? collections : [collections];
    const tasks = [];

    if (selected.includes("newdeal")) {
      tasks.push(NewDeal.create({
        title,
        description,
        image,
        price,
        featured: false,
      }));
    }

    if (selected.includes("drop")) {
      tasks.push(Drop.create(data));
    }

    if (selected.includes("deal")) {
      tasks.push(Deal.create(data));
    }

    await Promise.all(tasks);
    
    res.send(` Data saved successfully in: ${selected.join(", ")}`);
  } catch (err) {
    console.error("Error saving deal:", err);
    res.status(500).send("Internal Server Error");
  }
};
const normalDeal = require("../../models/NormalDeal");

// List all normal deals
exports.listNormalDeals = async (req, res) => {
  try {
    const normalDeals = await normalDeal.find();
    res.render("admin/normalDeals/list", { normalDeals, user: req.user });
  } catch (err) {
    console.error(err);
    res.send("Error fetching normal deals");
  }
};
exports.showCreateNormalDeal = (req, res) => {
  res.render("admin/normalDeals/create", { error: null, user: req.user });
};
exports.createNormalDeal = async (req, res) => {
  const { title, description, image, price, featured } = req.body;
  const normalDeal = new normalDeal({ title, description, image, price, featured });
  await normalDeal.save();
  res.redirect("/api/admin/normal-deals");
};
const NewDeal = require("../../models/NormalDeal");
const Deal = require("../../models/24HrDeal");
const Drop = require("../../models/FruitDrop");

// Show all NewDeals
exports.listNewDeals = async (req, res) => {
    const newDeals = await NewDeal.find();
    res.render("admin/newdeals", { newDeals });
};

// Show form to create Deal or Drop from NewDeal
exports.showCreateForm = async (req, res) => {
    const { id } = req.params;
    const { type } = req.query; // 'deal' or 'drop'
    const newDeal = await NewDeal.findById(id);
    res.render("admin/createFromNewDeal", { newDeal, type });
};

// Handle form submission
exports.createFromNewDeal = async (req, res) => {
  try {
    const { newDealId, type, discount } = req.body;

    const newDeal = await NewDeal.findById(newDealId);
    if (!newDeal) return res.status(404).send("NewDeal not found");

    if (type === "deal") {
      // ✅ Create a 24-hour auto-expiring deal
      const deal = new Deal({
        title: newDeal.title,
        description: newDeal.description,
        image: newDeal.image,
        price: newDeal.price,
        discount: discount || 0,
        featured: newDeal.featured || false,
      });
      await deal.save();
      return res.redirect("/api/admin/deals");

    } else if (type === "drop") {
      // ✅ Create a Drop (non-expiring)
      const drop = new Drop({
        title: newDeal.title,
        description: newDeal.description,
        image: newDeal.image,
        price: newDeal.price,
        discount: discount || 0,
        featured: newDeal.featured || false,
      });
      await drop.save();
      return res.redirect("/api/admin/drops");
    }

    res.send("Invalid type selected");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error creating from NewDeal: " + err.message);
  }
};
// Show dynamic form
exports.showDynamicCreateForm = async (req, res) => {
  const newDeals = await NewDeal.find();
  res.render("admin/single-deal/createform", { newDeals });
};

// Handle form submission
exports.createFromNewDealDynamic = async (req, res) => {
    const { newDealId, type, discount } = req.body;

    try {
        const newDeal = await NewDeal.findById(newDealId);
        if (!newDeal) return res.status(404).send("NewDeal not found");

        if (type === "deal") {
            // ✅ Create 24hr auto-expiring deal
            await Deal.create({
                title: newDeal.title,
                description: newDeal.description,
                image: newDeal.image,
                price: newDeal.price,
                featured: newDeal.featured || false,
                discount: discount || 0
            });
        }
        else if (type === "drop") {
            // ✅ Create Drop (non-expiring)
            await Drop.create({
                title: newDeal.title,
                description: newDeal.description,
                image: newDeal.image,
                price: newDeal.price,
                featured: newDeal.featured || false,
                discount: discount || 0
            });
        }

        res.redirect("/api/admin/single-deals");
    } catch (err) {
        console.error("Error creating from NewDeal:", err);
        res.status(500).send("Error creating from NewDeal: " + err.message);
    }
};
