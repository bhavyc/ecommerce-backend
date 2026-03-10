const cron = require("node-cron");
const Product = require("../models/Product");
const Drop = require("../models/FruitDrop");
const Deal24Hr = require("../models/24HrDeal");
const SlotBooking = require("../models/SlotBooking");

// ==========================================
// 1. GENERATE DAILY DROPS (Unlimited Paid)
// ==========================================
const generateDailyDrop = async () => {
  try {

    // Purane drops delete karo taaki list fresh ho
    await Drop.deleteMany({}); 

    // ✅ NEW LOGIC: Find ALL Paid & Unprocessed Drop Slots
    const paidSlots = await SlotBooking.find({
      type: "DROP",
      status: "PAID",
      isProcessed: false
    }).populate("product");

    console.log(`Found ${paidSlots.length} paid DROP slots.`);

    if (paidSlots.length > 0) {
        // Sabko Drop bana do
        for (const slot of paidSlots) {
            if (slot.product) {
                await Drop.create({
                    product: slot.product._id,
                    seller: slot.seller,
                    title: slot.product.title,
                    description: slot.product.description,
                    image: slot.product.image,
                    price: slot.product.price,
                    discount: slot.discount, // Seller ka discount
                    featured: true
                });

                // Mark processed taaki kal dobara na aaye
                slot.isProcessed = true;
                await slot.save();
            }
        }
    } else {
        //Fallback: Agar koi paid slot nahi hai, toh 1 Random Product dikha do
        //Taaki section khali na lage
        const count = await Product.countDocuments();
        if (count > 0) {
          
            const random = Math.floor(Math.random() * count);
            const prod = await Product.findOne().skip(random);
            
            if(prod) {
                await Drop.create({
                    product: prod._id,
                    seller: prod.seller,
                    title: prod.title,
                    description: prod.description,
                    image: prod.image,
                    price: prod.price,
                    discount: 50, // System generated attraction
                    featured: true
                });
            }
        }
    }
    console.log("Daily Drops Generated.");

  } catch (err) {
    console.error("Daily Drop Error:", err);
  }
};

// ==========================================
// 2. GENERATE DAILY DEALS (Unlimited Paid)
// ==========================================
const generateDailyDeals = async () => {
  console.log("Generating 24-Hr Deals...");
  
  try {
    await Deal24Hr.deleteMany({}); 

    //  NEW LOGIC: Find ALL Paid Slots
    const paidSlots = await SlotBooking.find({
      type: "DEAL",
      status: "PAID",
      isProcessed: false
    }).populate("product");

    // Sabko Deal bana do
    for (const slot of paidSlots) {
      if (slot.product) {
        await Deal24Hr.create({
          product: slot.product._id,
          seller: slot.seller,
          title: slot.product.title,
          description: slot.product.description,
          image: slot.product.image,
          price: slot.product.price,
          discount: slot.discount,
          featured: true,
          isGroupBuyAvailable: true, 
          groupPrice: Math.round(slot.product.price * (1 - ((slot.discount + 5)/100))),
          groupSize: 2
        });

        slot.isProcessed = true;
        await slot.save();
      }
    }

    // --- RANDOM FILLER ---
    // Agar Paid slots kam hain (e.g. 5 se kam), toh thode random daal do taaki page bhara lage
    // Lekin Paid slots ko kabhi mat roko.
    if (paidSlots.length < 5) {
        const needed = 5 - paidSlots.length;
        const randomProducts = await Product.aggregate([{ $sample: { size: needed } }]);

        for (const prod of randomProducts) {
            await Deal24Hr.create({
                product: prod._id,
                seller: prod.seller,
                title: prod.title,
                description: prod.description,
                image: prod.image,
                price: prod.price,
                discount: 0, // Random par discount nahi
                featured: false
            });
        }
    }
    console.log("24-Hr Deals Generated.");

  } catch (err) {
    console.error("Automation Error (Deals):", err.message);
  }
};

const startAutomation = () => {
   // Raat ko 12 baje chalega
   cron.schedule("0 0 * * *", () => {
     generateDailyDrop();
     generateDailyDeals();
   });
   console.log("Automation Engine Started.");
};

module.exports = { startAutomation, generateDailyDrop, generateDailyDeals };