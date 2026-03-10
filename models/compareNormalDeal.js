const mongoose = require("mongoose");

const compareNormalDealSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  items: [
    {
      deal: { type: mongoose.Schema.Types.ObjectId, ref: "NormalDeal", required: true },
      title: String,
      image: String,
      price: Number,
      description: String,
      featured: Boolean,
      addedAt: { type: Date, default: Date.now }
    }
  ],
  updatedAt: { type: Date, default: Date.now }
});

compareNormalDealSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("CompareNormalDeal", compareNormalDealSchema);
