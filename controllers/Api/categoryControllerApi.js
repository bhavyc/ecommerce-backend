const Product = require("../../models/Product");
const NormalDeal = require("../../models/NormalDeal");

// ðŸŸ¢ 1. GET ALL CATEGORIES (For Frontend Menu/Sidebar)
exports.getCategories = async (req, res) => {
  try {
    // Finds all unique categories currently in the Product collection
    const categories = await Product.distinct("category");
    
    res.status(200).json({
      success: true,
      count: categories.length,
      categories: categories.sort() // Alphabetical order
    });
  } catch (err) {
    console.error("Get Categories Error:", err);
    res.status(500).json({ success: false, message: "Server Error fetching categories" });
  }
};

// ðŸŸ¢ 2. GET ITEMS BY CATEGORY
exports.getItemsByCategory = async (req, res) => {
  try {
    const categoryName = req.params.categoryName;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // STEP 1: Find all Products that match this category
    // We only need their _id to filter the Deals
    const matchingProducts = await Product.find({ 
      category: { $regex: new RegExp("^" + categoryName + "$", "i") } // Case-insensitive match
    }).select("_id");

    const productIds = matchingProducts.map(p => p._id);

    // STEP 2: Find NormalDeals linked to these products
    // (Assuming your frontend displays Deals, not raw Products)
    const deals = await NormalDeal.find({ product: { $in: productIds } })
      .populate("product")
      .skip(skip)
      .limit(limit);
      
    const totalDeals = await NormalDeal.countDocuments({ product: { $in: productIds } });

    // STEP 3: Format Data (Calculate Final Price)
    const formattedData = deals.map(deal => {
      const finalPrice = deal.discount > 0 
        ? deal.price - (deal.price * (deal.discount / 100))
        : deal.price;

      return {
        _id: deal._id,
        title: deal.title,
        image: deal.image,
        price: deal.price,
        discount: deal.discount,
        finalPrice: Math.round(finalPrice),
        category: deal.product.category, // Send category back for UI
        description: deal.description
      };
    });

    res.status(200).json({
      success: true,
      category: categoryName,
      count: formattedData.length,
      pagination: {
        totalItems: totalDeals,
        totalPages: Math.ceil(totalDeals / limit),
        currentPage: page
      },
      data: formattedData
    });

  } catch (err) {
    console.error("Category Filter Error:", err);
    res.status(500).json({ success: false, message: "Error fetching items by category" });
  }
};