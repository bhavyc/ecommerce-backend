 const normalDeal = require("../models/NormalDeal");
 
const Inventory = require("../models/Inventory");
// Get all deals
exports.getDeals = async (req, res) => {
  try {
    const deals = await normalDeal.find().populate("product");
  
    res.json(deals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get featured deals
exports.getFeaturedDeals = async (req, res) => {
  try {
    const featuredDeals = await normalDeal.find({ featured: true });
    res.json(featuredDeals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
 


exports.renderDealsPage = async (req, res) => {
  try {
    const deals = await normalDeal.find()
      .populate({
        path: "product",
        populate: {
          path: "qas",
          model: "Question",
          populate: [
            { path: "user" },
            { path: "answers.user" }
          ]
        }
      });

    const updatedDeals = deals.map(deal => ({
      ...deal.toObject(),
      qas: deal.product?.qas || []
    }));

    res.render("normalDeals/list", {
      deals: updatedDeals,
      user: req.user || null
    });

  } catch (err) {
    res.status(500).send("Error loading deals: " + err.message);
  }
};

// exports.renderDealsPage = async (req, res) => {
//   try {
//     const deals = await normalDeal.find();
    
//     // ✅ FIX: Pass the 'user' object from the request to the template.
//     // We use "req.user || null" to safely handle cases where no one is logged in.
//     res.render("normalDeals/list", { 
//       deals: deals,
//       user: req.user || null 
//     });

//   } catch (err) {
//     res.status(500).send("Error loading deals: " + err.message);
//   }
// }; 

exports.createNewDealFromInventory = async (req, res) => {
  const { inventoryId } = req.body;
  const adminId = req.user._id;

  const inventory = await Inventory.findById(inventoryId).populate("product seller");
  if (!inventory) return res.status(404).json({ message: "Inventory not found" });

  const product = inventory.product;

  const newDeal = new NewDeal({
    product: product._id,
    inventory: inventory._id,
    title: product.title,
    description: product.description,
    image: product.image,
    price: product.price,
    discount: product.discount || 0,
    featured: product.featured,
    createdBy: adminId
  });

  await newDeal.save();
  res.status(201).json({ message: "NewDeal created from inventory", newDeal });
};
