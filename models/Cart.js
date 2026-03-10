const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema({
  // ... (Purana code same rahega)
  itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
  itemType: { type: String, enum: ["Drop", "24HrDeal", "NormalDeal"], required: true },
 seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // 🔥 YE ADD KIYA
 
  title: String,
  price: Number,
  discount: { type: Number, default: 0 },
  quantity: { type: Number, default: 1 },
  image: String
}, { _id: false });

const cartSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  items: [cartItemSchema],
  
  // ✅ NEW FIELDS
  subtotal: { type: Number, default: 0 },      // Items ka total
  deliveryFee: { type: Number, default: 0 },   // Delivery charge
  totalAmount: { type: Number, default: 0 },   // Final (Subtotal + Delivery)
  
  updatedAt: { type: Date, default: Date.now }
});

// ✅ AUTO CALCULATION LOGIC
cartSchema.pre("save", function(next) {
  this.subtotal = this.items.reduce((sum, item) => {
    const effective = item.price - (item.price * (item.discount / 100));
    return sum + effective * item.quantity;
  }, 0);

  // ✅ FIXED DELIVERY FEE LOGIC
  this.deliveryFee = this.subtotal > 0 ? 40 : 0; 

  this.totalAmount = Math.round(this.subtotal + this.deliveryFee);
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Cart", cartSchema);