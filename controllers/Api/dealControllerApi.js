const Deal = require("../../models/24HrDeal");

// // 🟢 List all active deals
// exports.listActiveDeals = async (req, res) => {
//   try {
//     // Optional: If your model has an 'expiresAt' field, you should filter:
//     // const deals = await Deal.find({ expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 });
    
    
//     // Using current logic (fetching all)
//     const deals = await Deal.find().sort({ createdAt: -1 });

//     // Calculate discountedPrice for each deal
//     const dealsWithDiscount = deals.map(deal => {
//       const dealObj = deal.toObject(); // Convert Mongoose doc to plain JS object
      
//       const discountedPrice = deal.discount
//         ? deal.price - (deal.price * deal.discount) / 100
//         : deal.price;

//       return { 
//         ...dealObj, 
//         discountedPrice: parseFloat(discountedPrice.toFixed(2)) // Format to 2 decimals
//       };
//     });

//     res.status(200).json({
//       success: true,
//       count: dealsWithDiscount.length,
//       data: dealsWithDiscount
//     });

//   } catch (err) {
//     console.error("List Deals Error:", err);
//     res.status(500).json({ success: false, message: "Error fetching deals" });
//   }
// };

// 🔍 Get Single Deal Details
exports.getDealById = async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id);
    
    if (!deal) {
      return res.status(404).json({ success: false, message: "Deal not found" });
    }

    // Calculate discount
    const discountedPrice = deal.discount
        ? deal.price - (deal.price * deal.discount) / 100
        : deal.price;

    res.status(200).json({
      success: true,
      data: {
        ...deal.toObject(),
        discountedPrice: parseFloat(discountedPrice.toFixed(2))
      }
    });

  } catch (err) {
    console.error("Get Deal Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// 🟢 Claim a deal
exports.claimDeal = async (req, res) => {
  try {
    const userId = req.user._id; // From Auth Middleware
    const dealId = req.params.id;

    const deal = await Deal.findById(dealId);
    if (!deal) {
      return res.status(404).json({ success: false, message: "Deal not found" });
    }

    // Check if user already claimed this deal
    // Assuming 'claimedBy' is an array of User IDs in the model
    const alreadyClaimed = deal.claimedBy.some(
      (id) => id.toString() === userId.toString()
    );

    if (alreadyClaimed) {
      return res.status(400).json({ 
        success: false, 
        message: "You have already claimed this deal" 
      });
    }

    // Add user to claimedBy array
    deal.claimedBy.push(userId);
    await deal.save();

    res.status(200).json({
      success: true,
      message: "Deal claimed successfully!",
      dealId: deal._id
    });

  } catch (err) {
    console.error("Claim Deal Error:", err);
    res.status(500).json({ success: false, message: "Error claiming deal" });
  }
};
// controllers/Api/dealControllerApi.js
// controllers/Api/orderControllerApi.js ya jahan deals fetch hoti hain

exports.listActiveDeals = async (req, res) => {
  try {
    const deals = await Deal.find().sort({ createdAt: -1 });

    const dealsWithDiscount = deals.map(deal => {
      const dealObj = deal.toObject();
      
      // ✅ 1. Standard Discounted Price calculate karo (Price - 10%)
      // Example: 1000 - (1000 * 0.10) = 900
      const standardDiscountedPrice = deal.price - (deal.price * (deal.discount / 100));
      
      return { 
        ...dealObj, 
        // 🔥 Is 'discountedPrice' ko hi Carousel, Detail aur Checkout har jagah use karna hai
        discountedPrice: Math.round(standardDiscountedPrice), 
        
        // MRP/Original Price
        originalPrice: deal.price, 
        
        // Group Buy Price (Agar user team bana kar khareede toh ₹850 wala case)
        groupBuyPrice: deal.groupPrice ? Math.round(deal.groupPrice) : null 
      };
    });

    res.status(200).json({
      success: true,
      deals: dealsWithDiscount // Frontend ko ab "deals" array milega
    });
  } catch (err) {
    console.error("Deal List Error:", err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};