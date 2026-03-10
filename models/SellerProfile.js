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
  termsAccepted: { type: Boolean, default: false },
indianGoodsDeclared: { type: Boolean, default: false },

// DigiLocker Fields
  kycStatus: { 
    type: String, 
    enum: ["PENDING", "PARTIAL", "VERIFIED", "FAILED"], 
    default: "PENDING" 
  },
  digiLockerData: {
    isAadhaarVerified: { type: Boolean, default: false },
    aadhaarName: String, // Name as per Aadhaar
    aadhaarDob: String,
    aadhaarGender: String,
    digiLockerId: String, // Unique user ID from DigiLocker
    verifiedAt: Date
  },


  status: { type: String, enum:["pending","under_review","approved","rejected"], default:"pending" }
},{ timestamps: true });

module.exports = mongoose.model("SellerProfile", sellerProfileSchema);
