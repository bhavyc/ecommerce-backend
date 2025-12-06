const CronJob = require("node-cron");
const NormalDeal = require("../models/NormalDeal");
const Deal = require("../models/24HrDeal");
const Drop = require("../models/FruitDrop");

// ---------------------------------------------------------
// 🌙 1. MIDNIGHT JOB: Generate 5 New "24Hr Deals"
// ---------------------------------------------------------
const generateDailyDeals = async () => {
  console.log("🌙 [Auto-Admin] Running Midnight Job: Generating New 24Hr Deals...");

  try {
    // A. Purani Deals Delete karo (Clean Slate)
    await Deal.deleteMany({});

    // B. Inventory se 5 Random Items uthao
    // MongoDB ka $sample operator random data laane ke liye best hai
    const randomItems = await NormalDeal.aggregate([{ $sample: { size: 5 } }]);

    if (randomItems.length === 0) {
      console.log("❌ No Normal Deals found to promote.");
      return;
    }

    // C. Unhe 24Hr Deal format mein convert karo
    const newDeals = randomItems.map(item => ({
      title: item.title,
      description: item.description,
      image: item.image,
      price: item.price, 
      // Logic: Flash deal hai toh Normal Discount se 15% aur zyada discount do
      discount: (item.discount || 0) + 15, 
      featured: true,
      
      // 🔥 Group Buy Logic (Randomly activate karo kuch deals par)
      isGroupBuyAvailable: Math.random() > 0.5, // 50% chance
      groupPrice: Math.floor(item.price * 0.7), // 30% off for groups
      groupSize: 3
    }));

    // D. Database mein save karo
    await Deal.insertMany(newDeals);
    console.log(`✅ Success: 5 New 24Hr Deals Created!`);

  } catch (err) {
    console.error("❌ Daily Deal Automation Error:", err);
  }
};

// ---------------------------------------------------------
// 🚀 2. DROP JOB: Generate 1 New "Fresh Drop" (Every 6 Hours)
// ---------------------------------------------------------
const generateFreshDrop = async () => {
  console.log("🚀 [Auto-Admin] Generating New Fresh Drop...");

  try {
    // A. Purane/Expired Drops ko hatao (Optional: Ya archive karo)
    // await Drop.deleteMany({}); // Uncomment agar purane hatane hain

    // B. 1 Random Item uthao
    const randomItem = await NormalDeal.aggregate([{ $sample: { size: 1 } }]);
    const product = randomItem[0];

    if (!product) return;

    // C. Drop create karo (Bohot bhari discount ke saath)
    const newDrop = new Drop({
      title: product.title,
      description: product.description,
      image: product.image,
      price: product.price,
      discount: 50, // Flat 50% OFF for Drops (Viral karne ke liye)
      featured: true,
      // Time Logic: Abhi shuru hoga, 6 ghante baad khatam
      startTime: new Date(),
      endTime: new Date(Date.now() + 6 * 60 * 60 * 1000) 
    });

    await newDrop.save();
    console.log(`✅ Success: New Drop Live - ${product.title}`);

  } catch (err) {
    console.error("❌ Drop Gen Error:", err);
  }
};

// ---------------------------------------------------------
// ⏳ SCHEDULER (Timers Set Karo)
// ---------------------------------------------------------
const startAutomation = () => {
  
  // 1. Daily Deals: Raat ko 12:00 baje (0 0 * * *)
  CronJob.schedule("0 0 * * *", () => {
    generateDailyDeals();
  });

  // 2. Fresh Drops: Har 6 ghante mein (0 */6 * * *)
  // E.g., 6 AM, 12 PM, 6 PM, 12 AM
  CronJob.schedule("0 */6 * * *", () => {
    generateFreshDrop();
  });

  console.log("⚙️ Automation Engine Started: Admin is now on autopilot.");
};

// Manual Trigger functions bhi export kar rahe hain testing ke liye
module.exports = { startAutomation, generateDailyDeals, generateFreshDrop };