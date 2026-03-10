const mongoose = require("mongoose");
const payoutSchema = new mongoose.Schema({
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  amount: Number,
  status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING" },
  bankDetails: Object, // Account No, IFSC copy kar lenge
  adminNote: String // Transaction ID (UTR)
}, { timestamps: true });
module.exports = mongoose.model("PayoutRequest", payoutSchema);