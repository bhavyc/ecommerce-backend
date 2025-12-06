const mongoose = require("mongoose");
const sellerProfileSchema = new mongoose.Schema({
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  businessName: { type: String, required: true },
  businessType: { type: String, enum:["Individual","Company"], required:true },
  panNumber: String,
  gstNumber: String,
  address: String,
  bankAccountNo: String,
  ifscCode: String,
  status: { type: String, enum:["pending","under_review","approved","rejected"], default:"pending" }
},{ timestamps: true });

module.exports = mongoose.model("SellerProfile", sellerProfileSchema);
