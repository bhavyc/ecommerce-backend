// models/SellerVerification.js
const mongoose = require("mongoose");

const sellerVerificationSchema = new mongoose.Schema({
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  verifiedBy: { type: String, required: true }, // admin username
  status: { type: String, enum: ["approved","rejected"], required: true },
  remarks: { type: String },
  verifiedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("SellerVerification", sellerVerificationSchema);
