const mongoose = require("mongoose");

const groupBuySchema = new mongoose.Schema({
  deal: { type: mongoose.Schema.Types.ObjectId, ref: "24HrDeal", required: true },
  
  // Who is in this group?
  members: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" }, // Link to their specific order
      joinedAt: { type: Date, default: Date.now }
    }
  ],

  requiredSize: { type: Number, required: true }, // e.g., 3
  
  status: { 
    type: String, 
    enum: ["OPEN", "COMPLETED", "EXPIRED"], 
    default: "OPEN" 
  },

  expiresAt: { type: Date, required: true } // Usually 24hrs from creation
}, { timestamps: true });

// 🕒 Auto-delete expired groups if you want, 
// OR keep them to show "Expired" status to users. 
// Let's keep them but use expiresAt for logic.
groupBuySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); 

module.exports = mongoose.model("GroupBuy", groupBuySchema);