const NormalDeal = require("../../models/NormalDeal");
const Inventory = require("../../models/Inventory");

// 🟢 GET ALL DEALS (Lightweight for Lists)
exports.getAllDeals = async (req, res) => {
  try {
    // Populate basic product info, but avoid deep nesting for the main list for performance
    const deals = await NormalDeal.find()
      .populate("product", "name image category") // Only fetch necessary fields
      .sort({ createdAt: -1 });

    // Calculate final prices for the frontend
    const processedDeals = deals.map(deal => {
      const finalPrice = deal.discount > 0 
        ? deal.price - (deal.price * (deal.discount / 100))
        : deal.price;

      return {
        ...deal.toObject(),
        finalPrice: parseFloat(finalPrice.toFixed(2))
      };
    });

    res.status(200).json({
      success: true,
      count: processedDeals.length,
      data: processedDeals
    });

  } catch (err) {
    console.error("Get All Deals Error:", err);
    res.status(500).json({ success: false, message: "Error loading deals", error: err.message });
  }
};

// 🟢 GET FEATURED DEALS
exports.getFeaturedDeals = async (req, res) => {
  try {
    const featuredDeals = await NormalDeal.find({ featured: true })
      .populate("product", "name image");

    res.status(200).json({
      success: true,
      data: featuredDeals
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error loading featured deals", error: err.message });
  }
};

// 🔍 GET SINGLE DEAL DETAILS (Heavy data with Q&A)
// This replaces the logic that was inside 'renderDealsPage' for deep population
exports.getDealById = async (req, res) => {
  try {
    const dealId = req.params.id;

    const deal = await NormalDeal.findById(dealId)
      .populate({
        path: "product",
        populate: {
          path: "qas", // Populating Questions attached to the product
          model: "Question",
          populate: [
            { path: "user", select: "name" }, // Question asker
            { path: "answers.user", select: "name" } // Answerers
          ]
        }
      });

    if (!deal) {
      return res.status(404).json({ success: false, message: "Deal not found" });
    }

    // Combine Deal data with the populated Product Q&A
    const finalPrice = deal.discount > 0 
        ? deal.price - (deal.price * (deal.discount / 100))
        : deal.price;

    const responseData = {
      ...deal.toObject(),
      finalPrice: parseFloat(finalPrice.toFixed(2)),
      qas: deal.product?.qas || [] // Explicitly attach QAs
    };

    res.status(200).json({
      success: true,
      data: responseData
    });

  } catch (err) {
    console.error("Get Deal Detail Error:", err);
    res.status(500).json({ success: false, message: "Server Error", error: err.message });
  }
};

// 🛡️ CREATE DEAL FROM INVENTORY (Admin Only)
exports.createDealFromInventory = async (req, res) => {
  const { inventoryId } = req.body;
  
  // Safety check for admin (assuming authMiddleware attaches req.user)
  const adminId = req.user ? req.user._id : null; 

  try {
    const inventory = await Inventory.findById(inventoryId).populate("product seller");
    
    if (!inventory) {
      return res.status(404).json({ success: false, message: "Inventory not found" });
    }

    const product = inventory.product;

    // Create the new deal
    const newDeal = new NormalDeal({
      product: product._id,
      inventory: inventory._id,
      title: product.title || product.name, // Fallback if title is missing
      description: product.description,
      image: product.image,
      price: product.price,
      discount: product.discount || 0,
      featured: product.featured || false,
      createdBy: adminId
    });

    await newDeal.save();

    res.status(201).json({ 
      success: true, 
      message: "Deal created successfully from inventory", 
      data: newDeal 
    });

  } catch (err) {
    console.error("Create Deal Error:", err);
    res.status(500).json({ success: false, message: "Error creating deal", error: err.message });
  }
};