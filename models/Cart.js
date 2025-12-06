const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, required: true }, // _id of Drop / 24HrDeal / NormalDeal
  itemType: { 
    type: String, 
    enum: ["Drop", "24HrDeal", "NormalDeal"], 
    required: true 
  },
  title: String,          // snapshot: title at time of adding
  price: Number,          // snapshot: current price
  discount: { type: Number, default: 0 },
  quantity: { type: Number, default: 1 },
  image: String
}, { _id: false });

const cartSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  items: [cartItemSchema],
  totalAmount: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
});

// 🧮 Auto total calculation
cartSchema.pre("save", function(next) {
  this.totalAmount = this.items.reduce((sum, item) => {
    const effective = item.price - (item.price * (item.discount / 100));
    return sum + effective * item.quantity;
  }, 0);
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Cart", cartSchema);
