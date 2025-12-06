const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  category: { type: String, default: "general" },
  price: { type: Number, required: true },
  discount: { type: Number, default: 0 },
   qas: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      question: String,
      answers: [
        {
          user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          answer: String,
          createdAt: { type: Date, default: Date.now }
        }
      ],
      createdAt: { type: Date, default: Date.now }
    }
  ],
  image: String,
  featured: { type: Boolean, default: false },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });  // auto createdAt & updatedAt

module.exports = mongoose.model("Product", productSchema);
