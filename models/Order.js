const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
  itemType: { type: String, enum: ["Drop", "24HrDeal", "NormalDeal"], required: true },
 seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // 🔥 YE ADD KIYA

  title: String,
  price: Number,
  discount: Number,
  quantity: Number,
  image: String,
  subtotal: Number
}, { _id: false });

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  items: [orderItemSchema],
  
subtotal: { type: Number },
  deliveryFee: { type: Number },
  totalAmount: { type: Number, required: true },
  shippingAddress: {
    fullName: String,
    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
    phone: String
  },

  paymentMethod: { type: String, enum: ["COD","WALLET","ONLINE"], default: "COD" },
  paymentStatus: { type: String, enum: ["PENDING", "PAID", "FAILED"], default: "PENDING" },
  orderStatus: { 
    type: String, 
    enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled","Group_Pending","Group_Failed","Payment_Failed"],
    default: "Pending" 
  },
  razorpayOrderId: { type: String },       // Razorpay ka order ID
  razorpayPaymentId: { type: String },     // Success hone par milega
  razorpaySignature: { type: String },     // Security verification ke liye
  isPaymentFinalized: { type: Boolean, default: false }, // Double processing rokne ke liye

  placedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);
