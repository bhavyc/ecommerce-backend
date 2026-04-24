const Cart = require("../../models/Cart");
const Drop = require("../../models/FruitDrop");
const NormalDeal = require("../../models/NormalDeal");
const Deal24Hr = require("../../models/24HrDeal");
const Claim = require("../../models/Claim");
const Product = require("../../models/Product");

// Helper: Get Model based on type
const getModelByType = (type) => {
  switch (type) {
    case "Drop": return Drop;
    case "NormalDeal": return NormalDeal;
    case "24HrDeal": return Deal24Hr;
    default: return null;
  }
};

const calculateTotal = (cart) => {
  if (!cart || !cart.items) return 0;

  // 1. Subtotal calculation (Discount apply karke)
  const subtotal = cart.items.reduce((sum, item) => {
    // Formula: Original Price - (Original Price * Discount / 100)
    const effectivePrice = item.price - (item.price * (item.discount / 100));
    return sum + (effectivePrice * item.quantity);
  }, 0);

  // 2. Delivery Fee (Hamesha apply hoga agar items hain)
  const deliveryFee = 0

  // 3. Values set karo
  cart.subtotal = Math.round(subtotal);
  cart.deliveryFee = deliveryFee;
  cart.totalAmount = Math.round(subtotal + deliveryFee);

  return cart.totalAmount;
};
// controllers/Api/cartControllerApi.js

exports.addToCart = async (req, res) => {
  try {
    const userId = req.user ? (req.user.id || req.user._id) : null;
    if (!userId) return res.status(401).json({ success: false, message: "User ID missing" });

    const { itemId, itemType, quantity = 1 } = req.body;

    const Model = getModelByType(itemType);
    if (!Model) return res.status(400).json({ success: false, message: "Invalid Item Type" });

    //  FIX: Saare deals ke liye product ko populate karo taaki seller ID mil sake
    const itemData = await Model.findById(itemId).populate("product");

    if (!itemData) return res.status(404).json({ success: false, message: "Item not found" });

    // FIX: Seller ID nikalne ka fail-safe tareeka
    // 1. Pehle check karo kya direct deal mein seller hai?
    // 2. Agar nahi, toh linked product se nikal lo
    let sellerId = itemData.seller || (itemData.product ? itemData.product.seller : null);

    if (!sellerId) {
        console.error(`Seller missing for ${itemType}: ${itemId}`);
        return res.status(400).json({ 
            success: false, 
            message: "This item cannot be added because seller info is missing in DB." 
        });
    }

    // --- Drop Claim Check (Purana logic) ---
    if (itemType === "Drop") {
       const existingClaim = await Claim.findOne({ user: userId, drop: itemId });
       if (existingClaim) {
          return res.status(400).json({ success: false, message: "You have already claimed this drop!" });
       }
    }

    let cart = await Cart.findOne({ user: userId });
    if (!cart) cart = new Cart({ user: userId, items: [] });

    const existingIndex = cart.items.findIndex(
      (it) => it.itemId.toString() === itemId && it.itemType === itemType
    );

    if (existingIndex > -1) {
      cart.items[existingIndex].quantity += parseInt(quantity);
      cart.items[existingIndex].seller = sellerId; // Update seller safely
    } else {
      cart.items.push({
        itemId,
        itemType,
        seller: sellerId, // ✅ Ab ye required field kabhi undefined nahi jayegi
        title: itemData.title || (itemData.product ? itemData.product.title : "Product"),
        price: itemData.price,
        discount: itemData.discount || 0,
        quantity: parseInt(quantity),
        image: itemData.image
      });
    }

    calculateTotal(cart); 
    await cart.save();

    res.status(200).json({ success: true, message: "Added to cart", cart });

  } catch (err) {
    console.error("Add to cart error details:", err);
    res.status(500).json({ success: false, message: "Server Error", error: err.message });
  }
};
//  GET CART
exports.getCart = async (req, res) => {
  try {
    const userId = req.user ? (req.user.id || req.user._id) : null;
    if (!userId) return res.status(401).json({ success: false, message: "User ID missing" });

    let cart = await Cart.findOne({ user: userId });
    
    if (!cart) {
      return res.status(200).json({ 
          success: true, 
          cart: { items: [], totalAmount: 0, subtotal: 0, deliveryFee: 0 } 
      });
    }

    calculateTotal(cart);
    res.status(200).json({ success: true, cart });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error fetching cart" });
  }
};

// 🗑 REMOVE ITEM
exports.removeItem = async (req, res) => {
  try {
    const userId = req.user ? (req.user.id || req.user._id) : null;
    const { itemId, itemType } = req.body;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });

    cart.items = cart.items.filter(
      (it) => !(it.itemId.toString() === itemId && it.itemType === itemType)
    );

    calculateTotal(cart);
    await cart.save();

    res.status(200).json({ success: true, message: "Item removed", cart });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

//  CLEAR CART
exports.clearCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const cart = await Cart.findOneAndUpdate(
      { user: userId },
      { items: [], totalAmount: 0, subtotal: 0, deliveryFee: 0 },
      { new: true }
    );
    res.status(200).json({ success: true, message: "Cart cleared", cart });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};