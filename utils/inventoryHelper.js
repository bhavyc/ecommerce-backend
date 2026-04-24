const Inventory = require("../models/Inventory");
const NormalDeal = require("../models/NormalDeal");
const Deal24Hr = require("../models/24HrDeal");
const Drop = require("../models/FruitDrop");

exports.reserveStock = async (items, session) => {
    for (const item of items) {
        let actualProductId = null;
        
        // Find the actual Product ID from the Deal/Drop
        if (item.itemType === "NormalDeal") {
            const deal = await NormalDeal.findById(item.itemId).session(session);
            if (deal) actualProductId = deal.product;
        } else if (item.itemType === "24HrDeal") {
            const deal = await Deal24Hr.findById(item.itemId).session(session);
            if (deal) actualProductId = deal.product;
        } else if (item.itemType === "Drop") {
            const drop = await Drop.findById(item.itemId).session(session);
            if (drop) actualProductId = drop.product;
        }
        if (!actualProductId) actualProductId = item.itemId;

        // ATOMIC CHECK AND DECREMENT
        const inventory = await Inventory.findOneAndUpdate(
            { 
                product: actualProductId, 
                seller: item.seller, 
                remaining: { $gte: item.quantity } // Ensure enough stock exists
            },
            { $inc: { remaining: -item.quantity, sold: item.quantity } },
            { session, new: true }
        );

        if (!inventory) {
            throw new Error(`Out of Stock: ${item.title}`);
        }
    }
};