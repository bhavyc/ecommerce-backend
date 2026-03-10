

const NormalDeal = require("../../models/NormalDeal");

exports.searchItems = async (req, res) => {
  try {
    const query = req.query.q; // Search term (e.g., "mango")
    
    // Pagination Params (Defaults: Page 1, Limit 10 items)
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // 1. Validation
    if (!query || query.trim() === "") {
      return res.status(400).json({ 
        success: false, 
        message: "Please enter a search term" 
      });
    }

    // 2. Search Logic
    const searchRegex = new RegExp(query, "i");
    const searchFilter = {
      $or: [
        { title: searchRegex },
        { description: searchRegex }
      ]
    };

    // 3. Parallel Execution: Total Count & Data Fetching
    // Hum Promise.all use karenge taaki Count aur Data dono ek saath aayein (Fast)
    const [totalItems, deals] = await Promise.all([
      NormalDeal.countDocuments(searchFilter), // Total kitne results hain
      NormalDeal.find(searchFilter)
        .sort({ createdAt: -1 }) // Newest first
        .skip(skip)              // Pehle ke items chhodo
        .limit(limit)            // Sirf 'limit' jitne items uthao
    ]);

    // 4. Calculate Final Price
    const formattedResults = deals.map(deal => {
      const finalPrice = deal.discount > 0 
        ? deal.price - (deal.price * (deal.discount / 100))
        : deal.price;

      return {
        ...deal.toObject(),
        finalPrice: parseFloat(finalPrice.toFixed(2)),
        type: "NormalDeal"
      };
    });

    // 5. Response with Pagination Info
    res.status(200).json({
      success: true,
      data: formattedResults,
      pagination: {
        totalItems,      // Total kitne items mile search mein
        totalPages: Math.ceil(totalItems / limit), // Total kitne pages bane
        currentPage: page,
        itemsPerPage: limit
      }
    });

  } catch (err) {
    console.error("Search Error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Server error during search", 
      error: err.message 
    });
  }
};