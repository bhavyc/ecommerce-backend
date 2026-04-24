const fs = require("fs"); 
const csv = require("csv-parser");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const ExcelJS = require('exceljs');
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
 
 

// Main Dashboard Logic
exports.getSellerDashboard = async (req, res) => {
  try {
    const sellerId = new mongoose.Types.ObjectId(req.user._id);

    // 1. Basic Stats from Inventory (Ye sahi hai)
    const allInventory = await Inventory.find({ seller: sellerId }).populate("product");
    const totalProducts = allInventory.length;
    let stockCount = 0;
    let soldCount = 0;
    
    allInventory.forEach(inv => {
      stockCount += (inv.remaining || 0);
      soldCount += (inv.sold || 0);
    });

    // 2. Revenue & Orders Aggregation (🔥🔥 FIX: Discount + Returns logic)
    const currentYear = new Date().getFullYear();
    const revenueData = await Order.aggregate([
      { 
        $match: { 
          "items.seller": sellerId,
          paymentStatus: "PAID", // Paisa aaya ho
          createdAt: { 
            $gte: new Date(`${currentYear}-01-01`), 
            $lte: new Date(`${currentYear}-12-31`) 
          } 
        } 
      },
      { $unwind: "$items" },
      { 
        $match: { 
          "items.seller": sellerId,
          // 🔥 FIX: Returned aur Cancelled items ko revenue se hata do
          "items.status": { $nin: ["Returned", "Cancelled", "Rejected"] } 
        } 
      },
      {
        $group: {
          _id: { $month: "$createdAt" }, 
          // 🔥 FIX: Calculation ab Effective Price (Price - Discount) par hogi
          monthlyRevenue: { 
            $sum: { 
                $multiply: [
                    { $subtract: [ "$items.price", { $multiply: ["$items.price", { $divide: ["$items.discount", 100] }] } ] },
                    "$items.quantity"
                ]
            } 
          },
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
      revenue: totalRevenue.toFixed(2), // Ab ye bilkul accurate aayega
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
    res.status(500).send("Server Error");
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
 res.redirect("/seller/dashboard");
    // res.status(201).json({ message: "Stock added successfully", inventory });
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

exports.getDailyOrders = async (req, res) => {
  try {
    let sellerId;
    if (req.user && req.user._id) {
      sellerId = req.user._id;
    } else {
      const token = req.cookies.sellerToken;
      if (!token) return res.redirect("/seller/auth/login");
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      sellerId = decoded.id;
    }

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
      const myItems = (order.items || []).filter(it => it.seller && it.seller.toString() === sellerId.toString());
      
      // 🔥 FIX: Grand Total ab Discount kaat kar calculate hoga
      const totalEffectiveEarnings = myItems.reduce((sum, i) => {
          const effectivePrice = (i.price || 0) - ((i.price || 0) * ((i.discount || 0) / 100));
          return sum + (effectivePrice * (i.quantity || 0));
      }, 0);

      return {
        _id: order._id,
        customerName: order.shippingAddress?.fullName || order.user?.name || "Customer",
        phone: order.shippingAddress?.phone || "N/A",
        address: order.shippingAddress 
                 ? `${order.shippingAddress.addressLine1}, ${order.shippingAddress.city}, ${order.shippingAddress.state}`
                 : "Address not provided",
        items: myItems,
        grandTotal: Math.round(totalEffectiveEarnings), // dikhayega wahi jo customer ne pay kiya
        status: order.orderStatus || "PENDING",
        time: new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
    });

    res.render("seller/dailyOrders", { 
      user: req.user || { _id: sellerId }, 
      orders: processedOrders, 
      selectedDate 
    });

  } catch (err) {
    console.error("Daily Orders Error:", err);
    res.status(500).send("Error loading orders");
  }
};
// ✅ BULLETPROOF EXCEL DOWNLOAD FUNCTION
exports.downloadDailyOrdersExcel = async (req, res) => {
  try {
    let sellerId = req.user?._id;
    if (!sellerId) {
        const token = req.cookies.sellerToken;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        sellerId = decoded.id;
    }

    let selectedDate = req.query.date || new Date().toISOString().split('T')[0];
    const start = new Date(selectedDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(selectedDate);
    end.setHours(23, 59, 59, 999);

    const orders = await Order.find({
      "items.seller": sellerId,
      paymentStatus: "PAID",
      createdAt: { $gte: start, $lte: end }
    }).populate("user", "name email");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Daily Orders');

    worksheet.columns = [
      { header: 'Order ID', key: 'id', width: 15 },
      { header: 'Time', key: 'time', width: 10 },
      { header: 'Customer', key: 'customer', width: 25 },
      { header: 'Items', key: 'items', width: 40 },
      { header: 'Selling Price (After Disc)', key: 'total', width: 20 }, // Column header update
      { header: 'Status', key: 'status', width: 15 }
    ];

    orders.forEach(order => {
      const myItems = (order.items || []).filter(it => it.seller && it.seller.toString() === sellerId.toString());
      const itemsString = myItems.map(i => `${i.title} x ${i.quantity}`).join(', ');
      
      // 🔥 FIX: Excel mein bhi Discounted Price
      const total = myItems.reduce((sum, i) => {
          const effectivePrice = i.price - (i.price * (i.discount / 100));
          return sum + (effectivePrice * i.quantity);
      }, 0);

      worksheet.addRow({
        id: order._id.toString().slice(-6).toUpperCase(),
        time: new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        customer: order.shippingAddress?.fullName || order.user?.name || "N/A",
        items: itemsString,
        total: Math.round(total),
        status: order.orderStatus
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Orders_${selectedDate}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    res.status(500).send("Excel Error: " + err.message);
  }
};

// controllers/seller/sellerController.js mein niche add kar
exports.printShippingLabel = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const sellerId = req.user._id;

        // Order dhundo aur check karo ki wo is seller ka hai ya nahi
        const order = await Order.findById(orderId);
        const profile = await SellerProfile.findOne({ seller: sellerId });

        if (!order) return res.status(404).send("Order not found");

        res.render("seller/shippingLabel", { order, profile });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error generating label");
    }
};


 
// controllers/seller/sellerController.js
exports.dispatchOrder = async (req, res) => {
    try {
        const { orderId, method, boyName, boyPhone, courierName, trackingId } = req.body;
        const sellerId = req.user._id; // Logged-in seller
        const Order = require("../../models/Order");

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        // 🔥 Logic: Sirf un items ko filter karo jo is seller ke hain
        let itemsToShip = order.items.filter(item => item.seller.toString() === sellerId.toString());

        if (itemsToShip.length === 0) {
            return res.status(400).json({ success: false, message: "No item found." });
        }

        const otp = method === "SELF" ? Math.floor(1000 + Math.random() * 9000).toString() : null;

        // Har item ke andar uski delivery details bharo
        itemsToShip.forEach(item => {
            item.status = "Shipped";
            item.deliveryDetails = {
                method: method,
                dispatchedAt: new Date(),
                boyName: boyName || null,
                boyPhone: boyPhone || null,
                courierName: courierName || null,
                trackingId: trackingId || null,
                otp: otp, // Har item (shipment) ka apna OTP
                dispatchProof: req.file ? req.file.path : item.deliveryDetails?.dispatchProof
            };
        });

        // Global status update: Agar kuch items ship ho gaye toh "Shipped" mark kar do
        order.orderStatus = "Shipped"; 
        await order.save();

        res.json({ 
            success: true, 
            message: method === "SELF" ? "Order Dispatched! Customer will get OTP." : "Courier details saved!",
            otp: otp // Verification ke liye agar zaroorat ho (Testing phase)
        });

    } catch (err) {
        console.error("Dispatch Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};
 
// controllers/seller/sellerController.js
exports.processRefund = async (req, res) => {
    try {
        const { orderId, action } = req.body; 
        const sellerId = req.user._id;

        const Order = require("../../models/Order");
        const User = require("../../models/User");
        const Transaction = require("../../models/Transaction");
        const Inventory = require("../../models/Inventory");
        const NormalDeal = require("../../models/NormalDeal");
        const Deal24Hr = require("../../models/24HrDeal");
        const Drop = require("../../models/FruitDrop");

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: "Order not found!" });

        // Reject Logic
        if (action === "REJECT") {
            order.returnDetails.status = "REJECTED";
            order.items.forEach(it => {
                if(it.seller.toString() === sellerId.toString()) it.status = "Delivered";
            });
            await order.save();
            return res.json({ success: true, message: "Return Request Rejected ." });
        }

        // --- ITEM-LEVEL SECURITY CHECK ---
        let sellerItems = order.items.filter(it => it.seller.toString() === sellerId.toString());

        const canRefund = sellerItems.some(it => 
            it.status === "Picked_Up" || 
            (it.status === "PICKUP_ASSIGNED" && it.returnDetails?.pickupMethod === "COURIER")
        );

        if (!canRefund) {
            return res.status(400).json({ 
                success: false, 
                message: "Please complete pickup first! (OTP verification pending)" 
            });
        }

        // --- START REFUND CALCULATION ---
        let amountToRefundToUser = 0;   
        let amountToDeductFromSeller = 0; 

        for (const item of order.items) {
            // Sirf un items ko pakdo jo return ho rahe hain aur is seller ke hain
            if (item.seller.toString() === sellerId.toString() && ["Picked_Up", "PICKUP_ASSIGNED"].includes(item.status)) {
                
                // 🔥 FIX: Pehle "Effective Price" nikaalo jo user ne pay ki thi
                const effectivePrice = item.price - (item.price * (item.discount / 100));
                const itemTotalUserPaid = Math.round(effectivePrice * item.quantity);
                
                // 🔥 FIX: Seller ka share (90% of Effective Price) jo kaatna hai
                const itemSellerShare = Math.round(itemTotalUserPaid * 0.90);

                amountToRefundToUser += itemTotalUserPaid;
                amountToDeductFromSeller += itemSellerShare;

                // Inventory Restock Logic (Keeping your logic exactly as it was)
                let actualProductId = null;
                if (item.itemType === "NormalDeal") {
                    const deal = await NormalDeal.findById(item.itemId);
                    if (deal) actualProductId = deal.product;
                } else if (item.itemType === "24HrDeal") {
                    const deal = await Deal24Hr.findById(item.itemId);
                    if (deal) actualProductId = deal.product;
                } else if (item.itemType === "Drop") {
                    const drop = await Drop.findById(item.itemId);
                    if (drop) actualProductId = drop.product;
                }
                if (!actualProductId) actualProductId = item.itemId;

                await Inventory.findOneAndUpdate(
                    { product: actualProductId, seller: sellerId },
                    { $inc: { remaining: item.quantity, sold: -item.quantity } }
                );

                // Status update to Returned
                item.status = "Returned";
            }
        }

        // 1. Seller Pending Balance Minus (Jitna seller ko MILA THA (90%), utna hi kategi)
        await User.findByIdAndUpdate(sellerId, { $inc: { pendingBalance: -amountToDeductFromSeller } });

        // 2. User Wallet Plus (Customer ko poora 100% Effective Price wapas milega)
        await User.findByIdAndUpdate(order.user, { $inc: { walletBalance: amountToRefundToUser } });

        // 3. --- TRANSACTION HANDLING (Partial Refund Logic) ---
        const sellerTransaction = await Transaction.findOne({ 
            orderId: order._id, 
            user: sellerId, 
            type: "CREDIT",
            status: "ON_HOLD" 
        });

        if (sellerTransaction) {
            // Transaction amount se Seller ka 90% wala hissa minus karo
            const newAmount = sellerTransaction.amount - amountToDeductFromSeller;

            if (newAmount <= 0) {
                sellerTransaction.status = "CANCELLED";
                sellerTransaction.amount = 0;
                sellerTransaction.description = "Full Order Refunded to Customer";
            } else {
                sellerTransaction.amount = newAmount;
                sellerTransaction.description += ` (Partial Refund Processed)`;
            }
            await sellerTransaction.save();
        }

        // 4. Customer ke liye Transaction record (Credit entry for 100% amount)
        await Transaction.create({
            user: order.user, 
            orderId: order._id, 
            amount: amountToRefundToUser,
            type: "CREDIT", 
            description: `Refund Received for returned items (Order: ${order._id.toString().slice(-6)})`, 
            status: "SUCCESS", 
            paymentGateway: "WALLET"
        });

        // Global status update if all items are returned
        const allReturned = order.items.every(it => it.status === "Returned" || it.status === "Cancelled");
        if (allReturned) {
            order.orderStatus = "Returned";
            order.returnDetails.status = "REFUNDED";
        }

        order.markModified('items');
        await order.save();

        res.json({ success: true, message: "Refund Successful!." });

    } catch (err) {
        console.error("REFUND ERROR:", err);
        res.status(500).json({ success: false, message: "Internal Error: " + err.message });
    }
};
// controllers/seller/sellerController.js
exports.getReturnsList = async (req, res) => {
    try {
        const sellerId = req.user._id;
        const Order = require("../../models/Order");

        // Un orders ko dhundo jisme is seller ke items return requested ya pickup phase mein hain
        const orders = await Order.find({
            "items": {
                $elemMatch: {
                    "seller": sellerId,
                    "status": { $in: ["Return_Requested", "PICKUP_ASSIGNED", "Picked_Up"] }
                }
            }
        }).populate("user", "name phone email");

        const sellerReturns = orders.map(order => {
            // Sirf is seller ke wahi items filter karo jo return ho rahe hain
            const myReturningItems = (order.items || []).filter(it => 
                it.seller.toString() === sellerId.toString() && 
                ["Return_Requested", "PICKUP_ASSIGNED", "Picked_Up"].includes(it.status)
            );
            
            // 🔥 FIX: Refundable Amount ab Discount kaat kar calculate hoga
            const totalEffectiveRefund = myReturningItems.reduce((sum, it) => {
                // Formula: Price - (Price * Discount / 100)
                const effectivePrice = (it.price || 0) - ((it.price || 0) * ((it.discount || 0) / 100));
                return sum + (effectivePrice * (it.quantity || 0));
            }, 0);
            
            return {
                ...order._doc,
                itemsToReturn: myReturningItems,
                // Dashboard par wahi amount dikhega jo actual refund hona hai
                sellerRefundableAmount: Math.round(totalEffectiveRefund) 
            };
        });

        res.render("seller/returns", { user: req.user, orders: sellerReturns });
    } catch (err) { 
        console.error("Returns List Error:", err);
        res.status(500).send("Error loading returns"); 
    }
};
// controllers/seller/sellerController.js
// controllers/seller/sellerController.js
// controllers/seller/sellerController.js

exports.assignReturnPickup = async (req, res) => {
    try {
        const { orderId, method, boyName, boyPhone, courierName, trackingId } = req.body;
        const Order = require("../../models/Order");
        const order = await Order.findById(orderId);
        const sellerId = req.user._id;

        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        const otp = method === "SELF" ? Math.floor(1000 + Math.random() * 9000).toString() : null;

        // 🔥 CRITICAL FIX: Item Level Status aur Details update karo
        let itemUpdated = false;
        order.items.forEach(item => {
            // Sirf is seller ke wahi items status badlo jo return requested the
            if (item.seller.toString() === sellerId.toString() && 
               (item.status === "Return_Requested" || item.status === "Normal")) {
                
                item.status = "PICKUP_ASSIGNED"; // Status update for Frontend
                item.returnDetails = {
                    pickupMethod: method,
                    pickupOTP: otp,
                    courierName: courierName,
                    trackingId: trackingId,
                    pickupBoyName: boyName,
                    pickupBoyPhone: boyPhone
                };
                itemUpdated = true;
            }
        });

        // Global status update for records
        order.returnDetails.status = "PICKUP_ASSIGNED";
        order.returnDetails.pickupMethod = method;

        // Mongoose ko array change ke baare mein batao
        order.markModified('items');
        await order.save();

        res.json({ success: true, message: "Pickup assigned and items updated!" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
// controllers/seller/sellerController.js
 