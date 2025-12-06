// models/Inventory.js
const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema({
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  totalStock: { type: Number, required: true },
  sold: { type: Number, default: 0 },
  remaining: { type: Number, default: 0 },

  //   available: { type: Number, default: 0 }, // ready to sell
  // reserved: { type: Number, default: 0 },  // orders placed but not shipped
  // sold: { type: Number, default: 0 },      // shipped
  // returned: { type: Number, default: 0 },  // returned items

  restocks: [
    {
      quantity: Number,
      date: { type: Date, default: Date.now }
    }
  ]
}, { timestamps: true });

// Auto-calculate remaining stock
inventorySchema.pre("save", function (next) {
  this.remaining = this.totalStock - this.sold;
  next();
});

module.exports = mongoose.models.Inventory || mongoose.model("Inventory", inventorySchema);

