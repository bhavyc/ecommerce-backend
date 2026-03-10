const mongoose = require("mongoose");

const slotBookingSchema = new mongoose.Schema({
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  type: { type: String, enum: ["DROP", "DEAL"] },
  amountPaid: { type: Number },
  status: { type: String, enum: ["PAID", "PENDING"], default: "PENDING" },
  isProcessed: { type: Boolean, default: false },
  
  // âœ… YEH ADD KARO: Taaki Automation ko pata chale discount kitna hai
  discount: { type: Number, required: true }, 

  razorpayOrderId: String,
  razorpayPaymentId: String
}, { timestamps: true });

module.exports = mongoose.model("SlotBooking", slotBookingSchema);