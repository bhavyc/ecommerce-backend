const mongoose = require("mongoose");

const _24HrdealSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  image: { type: String },
  featured: { type: Boolean, default: false },
  price: { type: Number, required: true },      // 💰 Original price
  discount: { type: Number, default: 0 },       // 📉 Discount percentage
  // claimedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

 isGroupBuyAvailable: { type: Boolean, default: false },
  groupPrice: { type: Number },                 // 📉 Cheaper price for teams
  groupSize: { type: Number, default: 2 },   

}, { timestamps: true });



// 🕒 TTL index: auto-delete after 24 hours of creation
_24HrdealSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

// 💡 Virtual field for discounted price
_24HrdealSchema.virtual("discountedPrice").get(function () {
  const discountAmount = this.price * (this.discount / 100);
  return Math.round(this.price - discountAmount);
});

// Ensure virtuals are included when converting to JSON or Object
_24HrdealSchema.set("toObject", { virtuals: true });
_24HrdealSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("24HrDeal", _24HrdealSchema);
