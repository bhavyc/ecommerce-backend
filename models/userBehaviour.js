const mongoose = require("mongoose");

const userBehaviorSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  viewedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
  purchasedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
}, { timestamps: true });

module.exports = mongoose.model("UserBehavior", userBehaviorSchema);
