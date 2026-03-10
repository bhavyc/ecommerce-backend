// models/Expense.js
const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // owner
  title: { type: String, required: true },
  amount: { type: Number, required: true },
  category: { type: String, default: "general" }, // e.g. groceries, travel, bills
 paymentMethod: { 
  type: String, 
  enum: ["CASH", "CARD", "UPI", "WALLET", "ONLINE", "OTHER"], 
  default: "CASH" 
},

  note: { type: String },
  expenseDate: { type: Date, default: Date.now }, // date when expense happened
}, { timestamps: true });

module.exports = mongoose.model("Expense", expenseSchema);
