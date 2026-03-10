require('dotenv').config(); // Agar .env use kar raha hai
const mongoose = require('mongoose');

// Apna Database URL yahan daal (ya process.env.MONGO_URI use kar)
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/my_drops"; 

const fixIndex = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Database Connected");

    const collection = mongoose.connection.collection("users");

    // Check indexes
    const indexes = await collection.indexes();
    console.log("Existing Indexes:", indexes);

    // Drop the problematic index
    // Note: Index ka naam error message mein 'referralCode_1' dikh raha hai
    try {
      await collection.dropIndex("referralCode_1");
      console.log("🎉 SUCCESS: Purana 'referralCode_1' index delete kar diya!");
    } catch (e) {
      console.log("⚠️ Index nahi mila ya pehle hi delete ho gaya hai.");
    }

    console.log("👉 Ab server restart kar, Mongoose naya 'sparse' index apne aap bana lega.");
    
  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    await mongoose.connection.close();
  }
};

fixIndex();