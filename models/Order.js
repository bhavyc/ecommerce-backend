const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
  itemType: { type: String, enum: ["Drop", "24HrDeal", "NormalDeal"], required: true },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: String,
  price: Number,
  quantity: Number,
  image: String,
  subtotal: Number,
  discount: Number,

  // 🔥 ITEM LEVEL STATUS (Aapke enum ko pura rakha hai)
  status: { 
    type: String, 
    enum: ["Normal", "Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Return_Requested", "Return_Pending", "PICKUP_ASSIGNED", "Picked_Up", "Picked_Up", "Returned", "Rejected"], 
    default: "Normal" 
  },
  
  // 🔥 ITEM LEVEL FORWARD DELIVERY
  deliveryDetails: {
    method: { type: String, enum: ["SELF", "COURIER"] },
    boyName: String,
    boyPhone: String,
    courierName: String,
    trackingId: String,
    otp: { type: String, select: false }, // Har seller ka apna alag OTP
    dispatchedAt: Date,
    deliveredAt: Date,
    dispatchProof: String
  },

  // 🔥 NEW: ITEM LEVEL RETURN DETAILS (Partial Return ke liye mandatory hai)
  returnDetails: {
    pickupMethod: { type: String, enum: ["SELF", "COURIER"] },
    status: { type: String, default: "NONE" },
    pickupBoyName: String,
    pickupBoyPhone: String,
    pickupOTP: { type: String, select: false },
    courierName: String,
    trackingId: String,
    pickupProof: String,
    requestedAt: Date,
    pickedUpAt: Date,
    reason: String
  }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  items: [orderItemSchema],
  subtotal: { type: Number },
  deliveryFee: { type: Number, default: 0 },
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
  
  // GLOBAL ORDER STATUS
  orderStatus: { 
    type: String, 
    enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Group_Pending", "Group_Failed", "Payment_Failed", "Return_Pending", "Return_Requested", "Picked_Up", "Returned"],
    default: "Pending" 
  },

  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },
  razorpaySignature: { type: String },
  isPaymentFinalized: { type: Boolean, default: false },

  // 🔥 GLOBAL DELIVERY DETAILS (For overall tracking)
  deliveryDetails: {
    deliveryMethod: { type: String, enum: ["SELF", "COURIER"], default: "SELF" },
    deliveryBoyName: String,
    deliveryBoyPhone: String,
    courierName: String,
    dispatchProof: String, 
    isCustomerConfirmed: { type: Boolean, default: false },
    trackingId: String,
    otp: { type: String, select: false },
    dispatchedAt: Date,
    deliveredAt: Date
  },

  // 🔥 GLOBAL RETURN DETAILS (For Seller Dashboard & Summary)
  returnDetails: {
    status: { type: String, enum: ["NONE", "REQUESTED", "PICKUP_ASSIGNED", "PICKED_UP", "REFUNDED", "REJECTED"], default: "NONE" },
    reason: String,
    pickupMethod: { type: String, enum: ["SELF", "COURIER"] },
    pickupBoyName: String,
    pickupBoyPhone: String,
    pickupOTP: { type: String, select: false }, 
    courierName: String,
    trackingId: String,
    pickupProof: String,
    requestedAt: Date,
    pickedUpAt: Date
  },

  isStockReserved: { type: Boolean, default: false },
reservationExpiry: { type: Date }, // Time until which stock is locked
  placedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);


// const mongoose = require("mongoose");

// const orderItemSchema = new mongoose.Schema({
//   itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
//   itemType: { type: String, enum: ["Drop", "24HrDeal", "NormalDeal"], required: true },


//    status: { type: String, enum: ["Normal", "Return_Requested", "Returned"], default: "Normal" },
  
   
//   status: { 
//     type: String, 
//     enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Return_Requested", "Picked_Up", "Returned"], 
//     default: "Pending" 
//   },
//   deliveryDetails: {
//     method: { type: String, enum: ["SELF", "COURIER"] },
//     boyName: String,
//     boyPhone: String,
//     courierName: String,
//     trackingId: String,
//     otp: { type: String, select: false }, // Har seller ka apna alag OTP
//     dispatchedAt: Date,
//     deliveredAt: Date
//   },




//  seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // 🔥 YE ADD KIYA

//   title: String,
//   price: Number,
//   discount: Number,
//   quantity: Number,
//   image: String,
//   subtotal: Number
// }, { _id: false });

// const orderSchema = new mongoose.Schema({
//   user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
//   items: [orderItemSchema],
  
// subtotal: { type: Number },
//   deliveryFee: { type: Number },
//   totalAmount: { type: Number, required: true },
//   shippingAddress: {
//     fullName: String,
//     addressLine1: String,
//     addressLine2: String,
//     city: String,
//     state: String,
//     postalCode: String,
//     country: String,
//     phone: String
//   },

//   paymentMethod: { type: String, enum: ["COD","WALLET","ONLINE"], default: "COD" },
//   paymentStatus: { type: String, enum: ["PENDING", "PAID", "FAILED"], default: "PENDING" },
//   orderStatus: { 
//     type: String, 
//     enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled","Group_Pending","Group_Failed","Payment_Failed","Return_Pending", // 🔥 YE ADD KARO
//         "Returned" , "Picked_Up"  ,"Return_Requested"       // 🔥 YE BHI ADD KARO (Future use liye)
//          ],
//     default: "Pending" 
//   },
//   razorpayOrderId: { type: String },       // Razorpay ka order ID
//   razorpayPaymentId: { type: String },     // Success hone par milega
//   razorpaySignature: { type: String },     // Security verification ke liye
//   isPaymentFinalized: { type: Boolean, default: false }, // Double processing rokne ke liye

// deliveryDetails: {
//     deliveryMethod: { type: String, enum: ["SELF", "COURIER"], default: "SELF" },
//     deliveryBoyName: String,
//     deliveryBoyPhone: String,
//     courierName: String,
//     dispatchProof: String, // Courier receipt ki image URL
//     isCustomerConfirmed: { type: Boolean, default: false },
//     trackingId: String,
//     otp: { type: String, select: false }, // Security: DB se fetch karte waqt hidden rahega
//     dispatchedAt: Date,
//     deliveredAt: Date
//   },

//   returnDetails: {
//     status: { type: String, enum:["NONE", "REQUESTED", "PICKUP_ASSIGNED", "PICKED_UP", "REFUNDED", "REJECTED"], default: "NONE" },
//     reason: String,
    
//     // 🔥 AB YE SAHI JAGAH PAR HAIN (RETURN BLOCK MEIN)
//     pickupMethod: { type: String, enum:["SELF", "COURIER"] },
//     pickupBoyName: String,
//     pickupBoyPhone: String,
//     pickupOTP: { type: String, select: false }, // OTP Customer ke liye (hidden)
//     courierName: String,
//     trackingId: String,
//     pickupProof: String, // Courier Receipt URL
    
//     pickedUpAt: Date,
//     requestedAt: Date
//   },
//   placedAt: { type: Date, default: Date.now }
// }, { timestamps: true });

// module.exports = mongoose.model("Order", orderSchema);
