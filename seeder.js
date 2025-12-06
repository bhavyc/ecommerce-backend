require("dotenv").config();
const mongoose = require("mongoose");
const Deal = require("./models/Deal"); // make sure path is correct

// Connect DB
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/my_drops";

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected..."))
  .catch(err => console.error("DB connection error:", err));

async function seedDeals() {
  try {

    
    
    await Deal.deleteMany({});
    console.log("Old deals cleared ✅");
    
    const now = new Date();
    const deals = [
      {
        title: "Mango Deal",
        description: "Fresh and juicy mangoes at 20% off!",
        price: 100,
        discount: 20,
        image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRDh6RmUj-ZuZw_77mK_iQzGxg1R46_hVjSxg&s",
        startTime: now,
        endTime: new Date(now.getTime() + 6 * 60 * 60 * 1000), // +6 hours
        featured: true,
      },
      {
        title: "Apple Deal",
        description: "Crispy apples for your healthy snacks.",
        price: 80,
        discount: 10,
        image: "https://www.collinsdictionary.com/images/full/apple_158989157.jpg",
        startTime: now,
        endTime: new Date(now.getTime() + 12 * 60 * 60 * 1000), // +12 hours
      },
      {
        title: "Banana Deal",
        description: "Sweet bananas at unbeatable prices.",
        price: 50,
        discount: 5,
        image: "https://nutritionsource.hsph.harvard.edu/wp-content/uploads/2018/08/bananas-1354785_1920.jpg",
        startTime: now,
        endTime: new Date(now.getTime() + 24 * 60 * 60 * 1000), // +1 day
      },
      // {
      //   title: "Orange Deal",
      //   description: "Fresh oranges for your vitamin C needs.",
      //   price: 70,
      //   discount: 15,
      //   image: "https://via.placeholder.com/400x250.png?text=Orange",
      //   startTime: now,
      //   endTime: new Date(now.getTime() + 3 * 60 * 60 * 1000), // +3 hours
      // }
    ];

    await Deal.insertMany(deals);
    console.log("4 deals seeded successfully ✅");

    mongoose.connection.close();
  } catch (err) {
    console.error("Seeder error:", err);
    mongoose.connection.close();
  }
}

seedDeals();
