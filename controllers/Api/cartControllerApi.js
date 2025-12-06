const Cart = require("../../models/Cart");
const Drop = require("../../models/FruitDrop");
const NormalDeal = require("../../models/NormalDeal");
const Deal24Hr = require("../../models/24HrDeal");

// Helper: Get Model based on type
const getModelByType = (type) => {
  switch (type) {
    case "Drop": return Drop;
    case "NormalDeal": return NormalDeal;
    case "24HrDeal": return Deal24Hr;
    default: throw new Error("Invalid item type");
  }
};

// Helper: Recalculate Cart Total
const calculateTotal = (items) => {
  return items.reduce((sum, item) => {
    const discountedPrice = item.price - (item.price * (item.discount / 100));
    return sum + discountedPrice * item.quantity;
  }, 0);
};

// 🛒 ADD TO CART
// exports.addToCart = async (req, res) => {
//   try {
//     const userId = req.user._id; // Get ID from Token (Auth Middleware)
//     const { itemId, itemType, quantity = 1 } = req.body;

//     // Validate Item Type
//     let Model;
//     try {
//       Model = getModelByType(itemType);
//     } catch (e) {
//       return res.status(400).json({ success: false, message: "Invalid item type" });
//     }

//     // Fetch Item Details
//     const itemData = await Model.findById(itemId);
//     if (!itemData) {
//       return res.status(404).json({ success: false, message: "Item not found" });
//     }

//     // Find or Create Cart
//     let cart = await Cart.findOne({ user: userId });
//     if (!cart) cart = new Cart({ user: userId, items: [] });

//     // Check if item exists in cart
//     const existingIndex = cart.items.findIndex(
//       (it) => it.itemId.toString() === itemId && it.itemType === itemType
//     );

//     if (existingIndex > -1) {
//       // Update quantity
//       cart.items[existingIndex].quantity += parseInt(quantity);
//     } else {
//       // Add new item
//       cart.items.push({
//         itemId,
//         itemType,
//         title: itemData.title || itemData.name,
//         price: itemData.price,
//         discount: itemData.discount || 0,
//         quantity: parseInt(quantity),
//         image: itemData.image || null,
//       });
//     }

//     // Recalculate Total
//     cart.totalAmount = calculateTotal(cart.items);

//     await cart.save();

//     res.status(200).json({
//       success: true,
//       message: "Item added to cart",
//       cart
//     });

//   } catch (err) {
//     console.error("Add to cart error:", err);
//     res.status(500).json({ success: false, message: "Server error", error: err.message });
//   }
// };



exports.addToCart = async (req, res) => {
  try {
    // 🔍 DEBUG LOG: Terminal mein dekho user kya aa raha hai
    console.log("🔹 req.user received:", req.user);

    // 🔴 CRITICAL FIX: ID nikalne ke saare tareeke try karo
    // JWT token mein kabhi 'id' hota hai, kabhi '_id'
    const userId = req.user ? (req.user.id || req.user._id || req.user.userId) : null;

    // Agar ab bhi ID nahi mili, toh yahin rok do (Crash mat hone do)
    if (!userId) {
      console.error("❌ Error: User ID not found in req.user");
      return res.status(401).json({ 
        success: false, 
        message: "Authentication error: User ID missing. Please Logout & Login again." 
      });
    }

    const { itemId, itemType, quantity = 1 } = req.body;

    // ... Baaki code waisa hi rahega ...
    const Model = getModelByType(itemType);
    if (!Model) return res.status(400).json({ success: false, message: "Invalid Item Type" });

    const itemData = await Model.findById(itemId);
    if (!itemData) return res.status(404).json({ success: false, message: "Item not found" });

    let cart = await Cart.findOne({ user: userId });
    
    // Yahan ab userId guaranteed hai, toh validation fail nahi hoga
    if (!cart) cart = new Cart({ user: userId, items: [] });

    // ... (Existing logic for pushing items) ...
    const existingIndex = cart.items.findIndex(
      (it) => it.itemId.toString() === itemId && it.itemType === itemType
    );

    if (existingIndex > -1) {
      cart.items[existingIndex].quantity += parseInt(quantity);
    } else {
      cart.items.push({
        itemId,
        itemType,
        title: itemData.title || itemData.name || "Product",
        price: itemData.price,
        discount: itemData.discount || 0,
        quantity: parseInt(quantity),
        image: itemData.image
      });
    }

    cart.totalAmount = calculateTotal(cart.items);
    await cart.save();

    res.status(200).json({ success: true, message: "Added to cart", cart });

  } catch (err) {
    console.error("Add to cart error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
// 🧾 GET USER CART
// exports.getCart = async (req, res) => {
//   try {
//     const userId = req.user._id; // Get ID from Token

//     const cart = await Cart.findOne({ user: userId });

//     if (!cart) {
//       // Return empty structure if no cart exists yet
//       return res.status(200).json({ 
//         success: true, 
//         cart: { items: [], totalAmount: 0, user: userId } 
//       });
//     }

//     res.status(200).json({
//       success: true,
//       cart
//     });

//   } catch (err) {
//     console.error("Get cart error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };
// controllers/Api/cartControllerApi.js

// ✅ GET USER CART
exports.getCart = async (req, res) => {
  try {
    // 🔴 FIX: Robust User ID Extraction (Same as addToCart)
    const userId = req.user ? (req.user.id || req.user._id || req.user.userId) : null;

    if (!userId) {
      return res.status(401).json({ success: false, message: "User ID missing" });
    }

    // Cart dhoondho
    const cart = await Cart.findOne({ user: userId });

    // Agar cart nahi mila, toh empty array bhejo (Error mat phenko)
    if (!cart) {
      return res.status(200).json({ 
        success: true, 
        cart: { items: [], totalAmount: 0 } 
      });
    }

    res.status(200).json({
      success: true,
      cart
    });

  } catch (err) {
    console.error("Get cart error:", err);
    res.status(500).json({ success: false, message: "Server error fetching cart" });
  }
};
// 🗑 REMOVE ITEM
exports.removeItem = async (req, res) => {
  try {
    // 🔴 FIX: Robust ID Check
    const userId = req.user ? (req.user.id || req.user._id || req.user.userId) : null;

    if (!userId) {
      return res.status(401).json({ success: false, message: "User ID missing" });
    }

    const { itemId, itemType } = req.body;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    // Filter out the item
    const initialLength = cart.items.length;
    cart.items = cart.items.filter(
      (it) => !(it.itemId.toString() === itemId && it.itemType === itemType)
    );

    if (cart.items.length === initialLength) {
      return res.status(404).json({ success: false, message: "Item not found in cart" });
    }

    // Recalculate Total
    cart.totalAmount = calculateTotal(cart.items);

    await cart.save();

    res.status(200).json({
      success: true,
      message: "Item removed",
      cart
    });

  } catch (err) {
    console.error("Remove item error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// 🧹 CLEAR CART (Isko bhi fix kar lo saath mein)
exports.clearCart = async (req, res) => {
  try {
    // 🔴 FIX: Robust ID Check
    const userId = req.user ? (req.user.id || req.user._id || req.user.userId) : null;

    const cart = await Cart.findOneAndUpdate(
      { user: userId },
      { items: [], totalAmount: 0 },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Cart cleared successfully",
      cart: cart || { items: [], totalAmount: 0 }
    });

  } catch (err) {
    console.error("Clear cart error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// 🧹 CLEAR CART
exports.clearCart = async (req, res) => {
  try {
    const userId = req.user._id;

    const cart = await Cart.findOneAndUpdate(
      { user: userId },
      { items: [], totalAmount: 0 },
      { new: true } // Return the updated doc
    );

    res.status(200).json({
      success: true,
      message: "Cart cleared successfully",
      cart: cart || { items: [], totalAmount: 0 }
    });

  } catch (err) {
    console.error("Clear cart error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};