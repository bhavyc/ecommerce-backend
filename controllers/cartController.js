const Cart = require("../models/Cart");
const Drop = require("../models/FruitDrop");
const NormalDeal = require("../models/NormalDeal");
const Deal24Hr = require("../models/24HrDeal");

const getModelByType = (type) => {
  switch (type) {
    case "Drop": return Drop;
    case "NormalDeal": return NormalDeal;
    case "24HrDeal": return Deal24Hr;
    default: throw new Error("Invalid item type");
  }
};



// 🛒 Add item to cart
exports.addToCart = async (req, res) => {
  try {
    const { userId, itemId, itemType, quantity = 1 } = req.body;
    const Model = getModelByType(itemType);
    const itemData = await Model.findById(itemId);
    if (!itemData) return res.send("Item not found");

    let cart = await Cart.findOne({ user: userId });
    if (!cart) cart = new Cart({ user: userId, items: [] });

    const existing = cart.items.find(
      (it) => it.itemId.toString() === itemId && it.itemType === itemType
    );

    if (existing) {
      existing.quantity += parseInt(quantity);
    } else {
      cart.items.push({
        itemId,
        itemType,
        title: itemData.title || itemData.name,
        price: itemData.price,
        discount: itemData.discount || 0,
        quantity,
        image: itemData.image || null,
      });
    }

    // Recalculate total
    cart.totalAmount = cart.items.reduce((sum, item) => {
      const discountedPrice = item.price - (item.price * (item.discount / 100));
      return sum + discountedPrice * item.quantity;
    }, 0);

    await cart.save();
    res.redirect(`/cart/${userId}`); // ✅ Redirect to view cart page
  } catch (err) {
    res.send("Error adding item: " + err.message);
  }
};

// 🧾 Show user cart (EJS View)
exports.getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.params.userId });
    if (!cart) {
      return res.render("cart/cart", { cart: { items: [], user: req.params.userId } });
    }
    res.render("cart/cart", { cart });
  } catch (err) {
    res.send("Error loading cart");
  }
};

// 🗑 Remove item
exports.removeItem = async (req, res) => {
  try {
    const { userId, itemId, itemType } = req.body;
    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.send("Cart not found");

    cart.items = cart.items.filter(
      (it) => !(it.itemId.toString() === itemId && it.itemType === itemType)
    );

    await cart.save();
    res.redirect(`/cart/${userId}`);
  } catch (err) {
    res.send("Error removing item");
  }
};

// 🧹 Clear cart
exports.clearCart = async (req, res) => {
  try {
    await Cart.findOneAndUpdate(
      { user: req.params.userId },
      { items: [], totalAmount: 0 }
    );
    res.redirect(`/cart/${req.params.userId}`);
  } catch (err) {
    res.send("Error clearing cart");
  }
};
