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
