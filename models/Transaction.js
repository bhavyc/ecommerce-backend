// // models/Transaction.js

// const mongoose = require("mongoose");

// const transactionSchema = new mongoose.Schema({
//   user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
//   orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" }, // Link to Order
//   amount: { type: Number, required: true },
//   type: { 
//     type: String, 
//     enum: ["CREDIT", "DEBIT"], // CREDIT = Aaya, DEBIT = Gaya
//     required: true 
//   },
//   description: { type: String, required: true },
//     releaseDate: { type: Date }, 
//   //  NEW FIELDS for better tracking
//  status: {
//   type: String,
//   enum: ["SUCCESS", "FAILED", "PENDING", "ON_HOLD", "CANCELLED"],
//   default: "PENDING"
// },
//   paymentGateway: { type: String, enum: ["WALLET", "RAZORPAY", "COD", "SYSTEM"], default: "SYSTEM" },
//   gatewayTransactionId: { type: String }, // razorpay_payment_id yahan store hoga

//   createdAt: { type: Date, default: Date.now }
// }, { timestamps: true });

// module.exports = mongoose.model("Transaction", transactionSchema);





// models/Transaction.js
// models/Transaction.js - Is poore file ko replace kar
const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
  amount: { type: Number, required: true },
  type: { type: String, enum: ["CREDIT", "DEBIT"], required: true },
  description: { type: String, required: true },
  releaseDate: { type: Date }, 
  status: { type: String, enum: ["SUCCESS", "FAILED", "PENDING", "ON_HOLD", "CANCELLED"], default: "PENDING" },
  paymentGateway: { type: String, enum: ["WALLET", "RAZORPAY", "COD", "SYSTEM", "MANUAL_BANK_TRANSFER"], default: "SYSTEM" },
  
  // 🔥 PRODUCTION FIX: gatewayTransactionId must be unique to prevent double payments
  gatewayTransactionId: { type: String, unique: true, sparse: true }, 

  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model("Transaction", transactionSchema);