// models/WelcomeDrop.js

const mongoose = require("mongoose");

const welcomeDropSchema = new mongoose.Schema({
    // Yeh drop kis user ke liye hai
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User", 
        required: true 
    },
    // Original drop ki ID, taaki hum link kar sakein
    originalDrop: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Drop", 
        required: true 
    },
    // Drop ki details (copy ki hui)
    title: { type: String, required: true },
    description: { type: String },
    image: { type: String },
    price: { type: Number, required: true }, 
    discount: { type: Number, default: 0 },

    // Sabse important field: Yeh document kab expire hoga
    expiresAt: {
        type: Date,
        required: true
    }
}, { timestamps: true });

// TTL Index: 'expiresAt' field ke time par pahunchte hi document ko delete kar do
// expireAfterSeconds: 0 ka matlab hai ki jaise hi 'expiresAt' ka time hoga, turant delete karo.
welcomeDropSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("WelcomeDrop", welcomeDropSchema);
