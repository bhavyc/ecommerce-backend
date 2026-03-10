const mongoose = require("mongoose");

const sellerDocumentSchema = new mongoose.Schema({
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  docType: String, // PAN, GST, Bank Proof
  filePath: String,
  uploadedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("SellerDocument", sellerDocumentSchema);
