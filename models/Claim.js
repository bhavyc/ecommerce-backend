const mongoose = require("mongoose");

const claimSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    drop: { type: mongoose.Schema.Types.ObjectId, ref: "Drop", required: true },
    // claimedAt: { type: Date, default: Date.now }
    claimedAt: { type: Date, default: Date.now },


});

// Ensure one user can claim a drop only once
claimSchema.index({ user: 1, drop: 1 }, { unique: true });

module.exports = mongoose.model("Claim", claimSchema);

