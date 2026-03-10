const mongoose = require("mongoose");

const _24HrdealSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  image: { type: String },
  featured: { type: Boolean, default: false },
  price: { type: Number, required: true },      // 💰 Original price
  discount: { type: Number, default: 0 },       // 📉 Discount percentage
  claimedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
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
const mongoose = require("mongoose");

const claimSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    drop: { type: mongoose.Schema.Types.ObjectId, ref: "Drop", required: true },
    // claimedAt: { type: Date, default: Date.now }
    claimedAt: { type: Date, default: Date.now },


});

// Ensure one user can claim a drop only once
claimSchema.index({ user: 1, drop: 1 }, { unique: true });

module.exports = mongoose.model("Claim", claimSchema);

// models/FruitDrop.js

const mongoose = require("mongoose");

// Naya, simplified schema
const fruitDropSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  image: { type: String },
  featured: { type: Boolean, default: false }, // Featured flag ab bhi important hai
  price: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  // startTime aur endTime hata diye gaye hain
  // claimedBy ko bhi hata sakte hain kyunki claim ab WelcomeDrop se manage hoga
}, { timestamps: true });

module.exports = mongoose.model("Drop", fruitDropSchema);
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

const mongoose = require("mongoose");
const normalDealSchema = new mongoose.Schema({
    title: 
    { 
    type: String,
    required: true 
    },
    description:
     {
         type: String,
          required: true 
        }, 
    image:
     {   
        type: String, 
        required: true 
    },
    price: {
         type: Number,
          required: true 
        },
    featured: 
    { type: Boolean,
         default: false
         },
}, { 
    timestamps: true
 }
);

module.exports = mongoose.model("NormalDeal", normalDealSchema);
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  category: { type: String, default: "general" },
  price: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  
  image: String,
  featured: { type: Boolean, default: false },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });  // auto createdAt & updatedAt

module.exports = mongoose.model("Product", productSchema);
const mongoose = require("mongoose");

const sellerDocumentSchema = new mongoose.Schema({
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  docType: String, // PAN, GST, Bank Proof
  filePath: String,
  uploadedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("SellerDocument", sellerDocumentSchema);
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
 



// const mongoose = require("mongoose");
// const bcrypt = require("bcryptjs");
// const Claim = require("./Claim");
// const Drop = require("./FruitDrop");

// const userSchema = new mongoose.Schema({
//     name: { type: String, required: true },
//     email: { type: String, required: true, unique: true },
//     password: { 
//         type: String, 
//         required: function() { return !this.googleId; } // only required if no Google ID
//     },
   
//     role: { type: String, enum: ["user", "admin","seller"], default: "user" },

//     // Membership fields
//     isMember: { type: Boolean, default: false },
//     membershipExpiry: { type: Date },
//     seenDrops: [{
//         dropId: { type: mongoose.Schema.Types.ObjectId, ref: 'Drop' },
//         seenAt: { type: Date }
//     }],
//     createdAt: { type: Date, default: Date.now }
// });

// // Hash password before saving
// userSchema.pre("save", async function(next) {
//     if (!this.isModified("password")) return next();
//     const salt = await bcrypt.genSalt(10);
//     this.password = await bcrypt.hash(this.password, salt);
//     next();
// });

// // Compare password
// userSchema.methods.comparePassword = async function(password) {
//     if (!this.password) return false; // handle Google users without password
//     return await bcrypt.compare(password, this.password);
// };




// models/User.js
// const mongoose = require("mongoose");
// const bcrypt = require("bcryptjs");

// // NEW: verification/account enums
// const VerificationState = ["PENDING", "UNDER_REVIEW", "VERIFIED", "REJECTED"];
// const AccountStatus = ["INACTIVE", "ACTIVE", "SUSPENDED"];

// const userSchema = new mongoose.Schema({
//   name: { type: String, required: true },
//   email: { type: String, required: true, unique: true },
//   mobile: { type: String }, // NEW
//   mobileVerifiedAt: { type: Date }, // NEW
//   password: { 
//     type: String,
//     required: function () { return !this.googleId; }
//   },
//   googleId: { type: String },

//   role: { type: String, enum: ["user","admin","seller"], default: "user" },

//   // Membership (existing)
//   isMember: { type: Boolean, default: false },
//   membershipExpiry: { type: Date },

//   // Seller onboarding flags
//   sellerVerification: {
//     state: { type: String, enum: VerificationState, default: "PENDING" },
//     reason: { type: String }, // rejection reason when REJECTED
//     currentStep: { 
//       type: String, 
//       enum: ["OTP","BASIC_INFO","BUSINESS","TAX_BANK","KYC_DOCS","REVIEW","DONE"], 
//       default: "OTP" 
//     }
//   },
//   accountStatus: { type: String, enum: AccountStatus, default: "INACTIVE" }, // Active only after verification

//   // UX
//   seenDrops: [{
//     dropId: { type: mongoose.Schema.Types.ObjectId, ref: 'Drop' },
//     seenAt: { type: Date }
//   }],

//   createdAt: { type: Date, default: Date.now }
// }, { timestamps: true });

// // Password hash
// userSchema.pre("save", async function(next){
//   if (!this.isModified("password")) return next();
//   const salt = await bcrypt.genSalt(10);
//   this.password = await bcrypt.hash(this.password, salt);
//   next();
// });

// // Compare
// userSchema.methods.comparePassword = async function(password){
//   if (!this.password) return false;
//   return bcrypt.compare(password, this.password);
// };

// module.exports = mongoose.model("User", userSchema);

// // Cascade delete middleware
// userSchema.pre("deleteOne", { document: true, query: false }, async function(next) {
//     try {
//         const userId = this._id;

//         // Delete all claims by this user
//         await Claim.deleteMany({ user: userId });

//         // Remove user from Drops' claimedBy arrays
//         await Drop.updateMany(
//             { claimedBy: userId },
//             { $pull: { claimedBy: userId } }
//         );

//         console.log(`Cleanup done for user ${userId}`);
//         next();
//     } catch (err) {
//         next(err);
//     }
// });

// module.exports = mongoose.model("User", userSchema);

// models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Claim = require("./Claim");
const Drop = require("./FruitDrop");
// const verificationStates = ["PENDING", "UNDER_REVIEW", "VERIFIED", "REJECTED"];

 

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["user","seller","admin"], default: "user" },
  isVerified: { type: Boolean, default: false },
  verificationStatus: { 
    type: String, 
    enum: ["UNDER_REVIEW","APPROVED","REJECTED"], 
    default: "UNDER_REVIEW" 
  },
  createdAt: { type: Date, default: Date.now }
});

// Hash password
userSchema.pre("save", async function(next){
  if(!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function(password){
  return bcrypt.compare(password, this.password);
};

 


// Cascade delete middleware
userSchema.pre("deleteOne", { document: true, query: false }, async function (next) {
  try {
    const userId = this._id;
    await Claim.deleteMany({ user: userId });
    await Drop.updateMany({ claimedBy: userId }, { $pull: { claimedBy: userId } });
    console.log(`Cleanup done for user ${userId}`);
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("User", userSchema);
// models/WelcomeDrop.js

const mongoose = require("mongoose");

const welcomeDropSchema = new mongoose.Schema({
    // Yeh drop kis user ke liye hai
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User", 
        required: true 
    },
    // Original drop ki ID, taaki hum link kar sakein
    originalDrop: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Drop", 
        required: true 
    },
    // Drop ki details (copy ki hui)
    title: { type: String, required: true },
    description: { type: String },
    image: { type: String },
    price: { type: Number, required: true }, 
    discount: { type: Number, default: 0 },

    // Sabse important field: Yeh document kab expire hoga
    expiresAt: {
        type: Date,
        required: true
    }
}, { timestamps: true });

// TTL Index: 'expiresAt' field ke time par pahunchte hi document ko delete kar do
// expireAfterSeconds: 0 ka matlab hai ki jaise hi 'expiresAt' ka time hoga, turant delete karo.
welcomeDropSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("WelcomeDrop", welcomeDropSchema);
