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
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },

    featured: 
    { type: Boolean,
         default: false
         },
}, { 
    timestamps: true
 }
);

module.exports = mongoose.model("NormalDeal", normalDealSchema);