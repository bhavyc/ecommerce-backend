const User = require("../../models/User");
const Transaction = require("../../models/Transaction"); // ✅ Ensure Transaction model import hai
const sendNotification = require("../../utils/sendNotification");
const Notification = require("../../models/Notification");
// 💧 Water the Tree
exports.waterTree = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId);

    // 1. Water Check
    if (user.game.waterDrops < 10) {
      return res.status(400).json({ success: false, message: "Not enough water! Shop to earn drops." });
    }

    // 2. Apply Water
    user.game.waterDrops -= 10;
    user.game.progress += 20;

    let message = "Tree watered! 🌱";

    // 3. Level Up Logic
    if (user.game.progress >= 100) {
      user.game.progress = 0;
      user.game.treeStage += 1; // Next Stage
      message = "Level Up! Your tree grew bigger! 🌳";
      
      // 🏆 HARVEST LOGIC (Jab Stage 3 se aage badhega)
      // Stages: 0(Seed) -> 1(Sapling) -> 2(Tree) -> 3(Fruit) -> 4(HARVEST)
      if (user.game.treeStage > 3) {
        
         

        // Reset Tree
        user.game.treeStage = 0; 
        
        //  REWARD ADD KARO (Safety Check ke saath)
        const currentBalance = user.walletBalance || 0; // Agar undefined hai to 0 lo
        user.walletBalance = currentBalance + 50;
await sendNotification(
  userId, 
  "Tree Harvested! ", 
  "Congratulations! You earned ₹50 from your tree harvest.", 
  "GAME"
);
        // 📝 Transaction Record Banao
        await Transaction.create({
          user: userId,
          amount: 50,
          type: "CREDIT",
          description: "🌳 Tree Harvest Reward",
          status: "SUCCESS"
        });

        message = `Harvest Complete! ₹50 added to Wallet! 🎉`;
      }
    }

    // 4. Save User (Game + Wallet Updates)
    await user.save();

    res.status(200).json({
      success: true,
      message,
      game: user.game,
      newBalance: user.walletBalance
    });

  } catch (err) {
    console.error("Game Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// 🎮 Get Game State (Ye same rahega)
exports.getGameState = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    let user = await User.findById(userId).select("game walletBalance"); // Wallet bhi fetch kar lo

    if (!user.game) {
      user.game = { waterDrops: 50, treeStage: 0, progress: 0 };
      await user.save();
    }

    res.status(200).json({ success: true, game: user.game });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error" });
  }
};