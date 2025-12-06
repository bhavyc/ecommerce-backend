require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs"); // just in case your model doesn't hash automatically
const User = require("./models/User"); // Update the path if needed

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/my_drops", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log(" MongoDB connected"))
.catch((err) => console.error(" MongoDB connection error:", err));

// Random seller names
const sellerNames = [
  "Rahul Sharma", "Anjali Verma", "Rohit Gupta", "Priya Singh", "Amit Kumar",
  "Sneha Patel", "Vikram Joshi", "Neha Mehta", "Karan Kapoor", "Simran Kaur",
  "Aditya Reddy", "Pooja Nair", "Siddharth Das", "Ritu Malhotra", "Arjun Choudhary",
  "Maya Sen", "Nikhil Rao", "Ananya Iyer", "Raghav Saxena", "Tanya Ghosh"
];

// Seeder function
const seedSellers = async () => {
  try {
    // Delete existing sellers (optional)
    await User.deleteMany({ role: "seller" });

    const sellers = [];

    for (let i = 0; i < sellerNames.length; i++) {
      const password = await bcrypt.hash("password123", 10); // hash password

      sellers.push({
        name: sellerNames[i],
        email: `seller${i + 1}@example.com`,
        password,
        role: "seller",
        isMember: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    await User.insertMany(sellers);
    console.log("✅ 20 sellers added successfully!");
    process.exit();
  } catch (err) {
    console.error("❌ Seeder error:", err);
    process.exit(1);
  }
};

seedSellers();
