 

// models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
// const Claim = require("./Claim");
const Drop = require("./FruitDrop");
// const verificationStates = ["PENDING", "UNDER_REVIEW", "VERIFIED", "REJECTED"];

 

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["user","seller","admin"], default: "user" },
  // Membership fields
  isMember: { type: Boolean, default: false },
  membershipExpiry: { type: Date },
     walletBalance: { type: Number, default: 0 }, 
  seenDrops: {
  type: [{
    dropId: { type: mongoose.Schema.Types.ObjectId, ref: 'Drop' },
    seenAt: { type: Date }
  }],
  default: [] // ✅ ensures it’s never undefined
},
 // 👇 Referral Fields Add Kar
  referralCode: { type: String, unique: true ,sparse: true}, // Khud ka code (e.g. BHAVYA123)
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Kisne bulaya
  isFirstOrderDone: { type: Boolean, default: false }, // Reward logic ke liye
game: {
    waterDrops: { type: Number, default: 50 }, // Shuruat mein 50 drops free
    treeStage: { type: Number, default: 0 },   // 0: Seed, 1: Sapling, 2: Tree, 3: Fruit
    progress: { type: Number, default: 0 }     // 0 to 100%
  },
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
