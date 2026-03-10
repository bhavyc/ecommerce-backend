// seed.js
require("dotenv").config();
const mongoose = require("mongoose");

// Models
const User = require("./models/User");
const Product = require("./models/Product");
const NormalDeal = require("./models/NormalDeal");
const Deal24Hr = require("./models/24HrDeal");
const Drop = require("./models/FruitDrop");
const Inventory = require("./models/Inventory");
const Order = require("./models/Order");
const Transaction = require("./models/Transaction");
const Expense = require("./models/Expense");
const GroupBuy = require("./models/GroupBuy");
const Question = require("./models/Questions");
const SellerProfile = require("./models/SellerProfile");
const PayoutRequest = require("./models/PayoutRequest");
const Notification = require("./models/Notification");

// ✅ AAPKA CONNECTION STRING
const MONGO_URI = "mongodb://127.0.0.1:27018/my_drops?replicaSet=rs0";

const seedData = async () => {
  try {
    console.log("🚀 Connecting to MongoDB Replica Set...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected!");

    console.log("🧹 Cleaning old data...");
    await Promise.all([
        User.deleteMany({}), Product.deleteMany({}), NormalDeal.deleteMany({}),
        Deal24Hr.deleteMany({}), Drop.deleteMany({}), Inventory.deleteMany({}),
        Order.deleteMany({}), Transaction.deleteMany({}), Expense.deleteMany({}),
        GroupBuy.deleteMany({}), Question.deleteMany({}), SellerProfile.deleteMany({}),
        PayoutRequest.deleteMany({}), Notification.deleteMany({})
    ]);

    // 1. CREATE USERS
    const seller = await User.create({
      name: "Bharat Wholesale Store",
      email: "seller@bharat.com",
      password: "password123",
      role: "user",
      referralCode: "SHOP001",
      walletBalance: 5000
    });

    const buyer = await User.create({
      name: "Rahul Sharma",
      email: "rahul@test.com",
      password: "password123",
      role: "user",
      referralCode: "RAHU123",
      isMember: true, // Pro Member for Drops
      membershipExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      walletBalance: 2000,
      game: { waterDrops: 150, treeStage: 1, progress: 50 }
    });

    await SellerProfile.create({
      seller: seller._id,
      businessName: "Bharat Wholesale",
      businessType: "Individual",
      bankAccountNo: "1234567890",
      ifscCode: "HDFC0001"
    });

    console.log("✅ Users & Profile Ready.");

    // 2. SEED NORMAL DEALS (6 Items)
    const normalItems = [
        { name: "Alphonso Mango", price: 1200, img: "https://images.unsplash.com/photo-1553279768-865429fa0078" },
        { name: "Organic Banana", price: 60, img: "https://images.unsplash.com/photo-1571771894821-ad99024177c6" },
        { name: "Green Apple", price: 200, img: "https://images.unsplash.com/photo-1567306226416-28f0efdc88ce" },
        { name: "Fresh Broccoli", price: 150, img: "https://images.unsplash.com/photo-1543362906-acfc16c67564" },
        { name: "Red Onion", price: 40, img: "https://images.unsplash.com/photo-1508747703725-719777637510" },
        { name: "Farm Carrots", price: 80, img: "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37" }
    ];

    console.log("📦 Seeding 6 Normal Deals...");
    for (const item of normalItems) {
        const p = await Product.create({
            name: item.name, title: item.name, description: `Fresh ${item.name} high quality.`,
            price: item.price, category: "Fruits", image: item.img, seller: seller._id
        });
        const inv = await Inventory.create({
            product: p._id, seller: seller._id, totalStock: 100, remaining: 90, sold: 10
        });
        await NormalDeal.create({
            product: p._id, inventory: inv._id, seller: seller._id, title: item.name,
            description: p.description, image: item.img, price: item.price, discount: 0, featured: true
        });
    }

    // 3. SEED 24HR DEALS (6 Items)
    const flashItems = [
        { name: "Earphone Bass", price: 1200, img: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df" },
        { name: "Smart Watch Z", price: 4999, img: "https://images.unsplash.com/photo-1523275335684-37898b6baf30" },
        { name: "Wireless Buds", price: 2500, img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e" },
        { name: "Power Bank", price: 1999, img: "https://images.unsplash.com/photo-1609091839311-d536819fe228" },
        { name: "Gaming Mouse", price: 1500, img: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf" },
        { name: "Bluetooth Speaker", price: 3500, img: "https://images.unsplash.com/photo-1608156639585-b3a032ef9689" }
    ];

    console.log("⚡ Seeding 6 Flash Deals...");
    for (const item of flashItems) {
        const p = await Product.create({
            name: item.name, title: item.name, description: `Special ${item.name}`,
            price: item.price, category: "Electronics", image: item.img, seller: seller._id
        });
        await Inventory.create({
            product: p._id, seller: seller._id, totalStock: 50, remaining: 45, sold: 5
        });
        await Deal24Hr.create({
            product: p._id, seller: seller._id, title: item.name, description: p.description,
            image: item.img, price: item.price, discount: 40, featured: true
        });
    }

    // 4. SEED DROPS (6 Items)
    const dropItems = [
        { name: "Cherry Basket", price: 600, img: "https://images.unsplash.com/photo-1528821128474-27f963b062bf" },
        { name: "Dragon Fruit", price: 150, img: "https://images.unsplash.com/photo-1527325672341-319b694ee8e2" },
        { name: "Kiwi Pack", price: 300, img: "https://images.unsplash.com/photo-1585059895316-2e8b2c24c297" },
        { name: "Avocado Butter", price: 400, img: "https://images.unsplash.com/photo-1523049673857-eb18f1d7b578" },
        { name: "Lychee Basket", price: 500, img: "https://images.unsplash.com/photo-1623341214825-9f4f963727da" },
        { name: "Pomegranate", price: 220, img: "https://images.unsplash.com/photo-1541344999736-83eca872977a" }
    ];

    console.log("💧 Seeding 6 Daily Drops...");
    for (const item of dropItems) {
        const p = await Product.create({
            name: item.name, title: item.name, description: `Member Drop ${item.name}`,
            price: item.price, category: "Fruits", image: item.img, seller: seller._id
        });
        await Drop.create({
            product: p._id, 
            seller: seller._id, 
            title: item.name, 
            description: p.description, 
            image: item.img, 
            price: item.price, 
            discount: 80, 
            featured: true,
            startTime: new Date(), 
            endTime: new Date(Date.now() + 2 * 60 * 60 * 1000)
        });
    }

    console.log("\n✅ DATABASE SEEDED SUCCESSFULLY!");
    console.log("Login: rahul@test.com / password123");
    process.exit(0);

  } catch (err) {
    console.error("\n❌ SEEDING ERROR:", err.message);
    process.exit(1);
  }
};

seedData();