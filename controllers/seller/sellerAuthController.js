
const User = require("../../models/User");
const SellerProfile = require("../../models/SellerProfile");
const SellerDocument = require("../../models/SellerDocument");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const Inventory = require("../../models/Inventory");
const Product = require("../../models/Product");
const Order = require("../../models/Order");
const NormalDeal = require("../../models/NormalDeal");
const Deal24Hr = require("../../models/24HrDeal");
const Drop = require("../../models/FruitDrop");
const crypto = require("crypto");
const nodemailer = require("nodemailer"); 
// multer setup
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => cb(null, "uploads/sellers"),
//   filename: (req, file, cb) => cb(null, Date.now() + "_" + file.originalname)
// });
// const upload = multer({ storage });



// ✅ CHANGE 1: Import Cloudinary Storage
const { sellerDocStorage } = require("../../config/cloudinary");

// ✅ CHANGE 2: Configure Multer with Cloudinary
const upload = multer({ storage: sellerDocStorage });
// ================= SELLER REGISTER (COMPLETE FUNCTION) =================

exports.register = async (req, res) => {
    try {
        const { name, email, password, businessName, businessType, panNumber, gstNumber, address, city, state, pincode, bankAccountNo, ifscCode } = req.body;

        const existing = await User.findOne({ email });
        if (existing) return res.status(400).send("Email already registered");

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ name, email, password: hashedPassword, role: "seller", verificationStatus: "UNDER_REVIEW" });
        await user.save();

        const profile = new SellerProfile({
            seller: user._id, businessName, businessType, panNumber, gstNumber,
            address, city, state, pincode, bankAccountNo, ifscCode, status: "under_review"
        });
        await profile.save();

        // 🔥 DEBUGGING LOGS
       
        const files = req.files || {};
         

        
        const getUrl = (fileArray, label) => {
            if (fileArray && fileArray[0]) {
                const path = fileArray[0].path || fileArray[0].url;
               
                return path;
            }
           
            return null;
        };

        const panUrl = getUrl(files.panDoc, "PAN");
        if (panUrl) {
            await new SellerDocument({ seller: user._id, docType: "PAN", filePath: panUrl }).save();
        }

        const gstUrl = getUrl(files.gstDoc, "GST");
        if (gstUrl) {
            await new SellerDocument({ seller: user._id, docType: "GST", filePath: gstUrl }).save();
        }

        const bankUrl = getUrl(files.bankDoc, "BANK");
        if (bankUrl) {
            await new SellerDocument({ seller: user._id, docType: "Bank", filePath: bankUrl }).save();
        }
        
       

        res.redirect("/seller/auth/under-review");

    } catch (err) {
        console.error("Register Error:", err);
        res.status(500).send("Registration Failed.");
    }
};
// ================= UNDER REVIEW PAGE =================
exports.underReview = (req,res) => {
  res.render("seller/underReview"); // create views/seller/underReview.ejs
};

// ================= SELLER LOGIN =================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const seller = await User.findOne({ email, role: "seller" });
    if (!seller) return res.status(404).send("Seller not found.");

    // check verification status
    if (seller.verificationStatus === "UNDER_REVIEW") {
      return res.redirect("/seller/auth/under-review");
    }
    if (seller.verificationStatus === "REJECTED") {
      return res.status(403).send("Your registration was rejected. Please register again.");
    }
     
    // const isMatch = await bcrypt.compare(password, seller.password);
    // if (!isMatch) return res.status(400).send("Invalid password.");
    
    const token = jwt.sign(
      { id: seller._id, role: seller.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
         
    res.cookie("sellerToken", token, { httpOnly: true, maxAge: 7*24*60*60*1000 });
    res.redirect("/seller/dashboard");
  } catch (err) {
  
    console.error(err);
    res.status(500).send("Server error during login.");
  }
};

 

exports.getDashboard = async (req, res) => {
  try {
    const token = req.cookies.sellerToken;
    if (!token) return res.redirect("/seller/auth/login");

    // ✅ Verify seller token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.role !== "seller") return res.redirect("/seller/auth/login");

    // ✅ Pagination setup
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const filter = { seller: user._id };

    // ✅ Inventory listing
    const [totalCount, inventory] = await Promise.all([
      Inventory.countDocuments(filter),
      Inventory.find(filter)
        .populate("product")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
    ]);

    const totalPages = Math.max(Math.ceil(totalCount / limit), 1);
    const hasPrev = page > 1;
    const hasNext = page < totalPages;

    // ✅ Dashboard summary counts
    const totalProducts = await Product.countDocuments({ seller: user._id });

    // ⚙️ Inventory summary
    const allInventories = await Inventory.find({ seller: user._id });
    const totalStock = allInventories.reduce((sum, inv) => sum + (inv.totalStock || 0), 0);
    const soldStock = allInventories.reduce((sum, inv) => sum + (inv.sold || 0), 0);
    const remainingStock = allInventories.reduce((sum, inv) => sum + (inv.remaining || 0), 0);

    // ⚙️ Orders summary
    const totalOrders = await Order.countDocuments({ "items.seller": user._id });

    // ⚙️ Total revenue (sum of paid orders for this seller)
    const paidOrders = await Order.find({ "items.seller": user._id, paymentStatus: "PAID" });
    const revenue = paidOrders.reduce((sum, order) => {
      const subtotalSum = order.items
        ?.filter(i => i.seller?.toString() === user._id.toString())
        .reduce((acc, item) => acc + (item.subtotal || 0), 0);
      return sum + subtotalSum;
    }, 0);

    // ⚙️ Low stock alert
    const lowStock = await Inventory.find({
      seller: user._id,
      remaining: { $lt: 5 }
    }).populate("product");

    // ⚙️ Deals summary
    const [normalDeals, timedDeals, dropDeals] = await Promise.all([
      NormalDeal.countDocuments({ seller: user._id }),
      Deal24Hr.countDocuments({ seller: user._id }),
      Drop.countDocuments({ seller: user._id }),
    ]);

    // ⚙️ Dynamic Monthly Sales (Last 12 months)
    const monthlySalesAgg = await Order.aggregate([
      { $match: { "items.seller": user._id, paymentStatus: "PAID" } },
      { $unwind: "$items" },
      { $match: { "items.seller": user._id } },
      {
        $group: {
          _id: { $month: "$createdAt" },
          total: { $sum: "$items.subtotal" }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const salesData = new Array(12).fill(0);
    monthlySalesAgg.forEach(ms => {
      salesData[ms._id - 1] = ms.total;
    });

    // ⚙️ Top Products by Sold Quantity
    const topProductsAgg = await Order.aggregate([
      { $match: { "items.seller": user._id, paymentStatus: "PAID" } },
      { $unwind: "$items" },
      { $match: { "items.seller": user._id } },
      {
        $group: {
          _id: "$items.product",
          totalSold: { $sum: "$items.quantity" }
        }
      },
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
      { $unwind: "$product" },
      {
        $project: {
          name: "$product.title",
          totalSold: 1
        }
      }
    ]);

    const topProductNames = topProductsAgg.map(p => p.name);
    const topProductSales = topProductsAgg.map(p => p.totalSold);

    // ✅ Render dashboard with all variables
    res.render("seller/dashboard", {
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
    console.error("⚠️ Dashboard Error:", err.message);
    res.redirect("/seller/auth/login");
  }
};


// ================= LOGOUT =================
 
// ================= LOGOUT =================
exports.logout = (req,res) => {
  res.clearCookie("sellerToken");
  res.redirect("/seller/auth/login");
};





// Email bhejne ke liye transporter setup (Gmail use kar rahe hain)
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER, // Apni email .env me dalein
        pass: process.env.EMAIL_PASS  // Apna App Password .env me dalein
    }
});

// 1. Render Forgot Password Page
exports.renderForgotPassword = (req, res) => {
    res.render("seller/forgotPassword", { error: null, success: null });
};

// 2. Process Forgot Password (Send Email)
exports.processForgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const seller = await User.findOne({ email, role: "seller" });

        if (!seller) {
            return res.render("seller/forgotPassword", { error: "No seller found with this email address.", success: null });
        }

        // Token generate karein
        const token = crypto.randomBytes(32).toString("hex");
        
        // Database me token aur expiry (1 hour) save karein
        seller.resetPasswordToken = token;
        seller.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await seller.save();

        // Email bhejein
        const resetUrl = `http://${req.headers.host}/seller/auth/reset-password/${token}`;
        
        const mailOptions = {
            to: seller.email,
            from: process.env.EMAIL_USER,
            subject: "Seller Password Reset Request",
            text: `Aapne password reset ki request ki hai. Niche diye gaye link par click karke naya password set karein:\n\n${resetUrl}\n\nYeh link 1 ghante tak valid hai.`
        };

        await transporter.sendMail(mailOptions);

        res.render("seller/forgotPassword", { success: "Password reset link sent to your email!", error: null });

    } catch (err) {
        console.error("Forgot Password Error:", err);
        res.render("seller/forgotPassword", { error: "Something went wrong. Try again later.", success: null });
    }
};

// 3. Render Reset Password Page
exports.renderResetPassword = async (req, res) => {
    try {
        const token = req.params.token;
        const seller = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() } // Check if token is not expired
        });

        if (!seller) {
            return res.send("Password reset token is invalid or has expired.");
        }

        res.render("seller/resetPassword", { token, error: null });
    } catch (err) {
        res.status(500).send("Server Error");
    }
};

// 4. Process Reset Password (Save New Password)
exports.processResetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password, confirmPassword } = req.body;

        if (password !== confirmPassword) {
            return res.render("seller/resetPassword", { token, error: "Passwords do not match." });
        }

        const seller = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!seller) {
            return res.render("seller/resetPassword", { token, error: "Token is invalid or has expired." });
        }

        // Naya password set karein. (Aapke User model me 'pre-save' hook hai, jo isko automatically hash kar dega!)
        seller.password = password;
        seller.resetPasswordToken = undefined;
        seller.resetPasswordExpires = undefined;
        
        await seller.save();

        // Login page par wapas bhej dein
        res.redirect("/seller/auth/login?msg=password_updated");

    } catch (err) {
        console.error("Reset Password Error:", err);
        res.render("seller/resetPassword", { token, error: "Something went wrong." });
    }
};
