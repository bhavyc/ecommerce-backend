const Drop = require("../../models/FruitDrop");
const User = require("../../models/User"); // Required to update 'seenDrops'
const Claim = require("../../models/Claim"); // ✅ IMPORT CLAIM MODEL
const Cart = require("../../models/Cart"); // 🔥 Cart model import karna mat bhoolna
const Order = require("../../models/Order"); // 🔥 Order model import karna mat bhoolna
// exports.listDrops = async (req, res) => {
//   try {
//     const now = new Date();
//     const userId = req.user.id || req.user._id;
    
//     const user = await User.findById(userId);
//     if (!user) return res.status(404).json({ success: false, message: "User not found" });

//     // 1. Membership Check
//     // (Agar membership date valid hai toh true)
//     const isMember = user.isMember && user.membershipExpiry && new Date(user.membershipExpiry) > now;

//     // 2. Claimed Drops Filter
//     const claimedIds = await Claim.find({ user: userId }).distinct('drop');
//     const claimedStrings = claimedIds.map(id => id.toString());

//     // 3. Active Drops Fetch
//     const allDrops = await Drop.find({ featured: true });
    
//     // Claimed wale hata do
//     const dropsToCheck = allDrops.filter(d => !claimedStrings.includes(d._id.toString()));

//     // --- CASE 1: NON-MEMBER (Locked) ---
//     if (!isMember) {
//        const lockedDrops = dropsToCheck.map(drop => ({
//           _id: drop._id,
//           title: drop.title,
//           image: drop.image,
//           price: drop.price,
//           finalPrice: drop.price,
//           discount: 0,
//           isLocked: true, 
//           message: "Unlock to see discount"
//       }));
//       return res.status(200).json({ success: true, isMember: false, drops: lockedDrops });
//     }

//     // --- CASE 2: MEMBER (Timer Logic with ATOMIC UPDATE) ---
    
//     const newSeenEntries = []; // Jo naye drops pehli baar dekhe gaye
//     const finalResponseDrops = [];

//     // User ke existing seenDrops ka map bana lo (Fast checking ke liye)
//     // Agar user.seenDrops undefined hai toh empty array maano
//     const seenMap = {};
//     if (user.seenDrops && user.seenDrops.length > 0) {
//         user.seenDrops.forEach(item => {
//             if (item.dropId) seenMap[item.dropId.toString()] = new Date(item.seenAt);
//         });
//     }

//     for (const drop of dropsToCheck) {
//         const dropIdStr = drop._id.toString();
//         let seenTime = seenMap[dropIdStr]; // Check karo kya DB mein hai?

//         if (!seenTime) {
//             // Agar DB mein nahi hai -> ABHI KA TIME LO
//             seenTime = new Date();
            
//             // List mein add karo taaki baad mein ek saath DB mein push karein
//             newSeenEntries.push({
//                 dropId: drop._id,
//                 seenAt: seenTime
//             });
//         }

//         // --- EXPIRY CALCULATION ---
//         // 15 Minutes = 15 * 60 * 1000 milliseconds
//         const expiryTime = new Date(seenTime.getTime() + 15 * 60 * 1000);
        
//         // Agar time khatam ho gaya hai (Current Time > Expiry), toh list mein mat dikhao
//         if (now > expiryTime) {
//             continue; // Skip this drop (Backend se hi hata diya)
//         }

//         // Calculate Final Price
//         const finalPrice = drop.discount > 0 
//             ? drop.price * (1 - drop.discount / 100) 
//             : drop.price;

//         finalResponseDrops.push({
//             _id: drop._id,
//             title: drop.title,
//             image: drop.image,
//             price: drop.price,
//             discount: drop.discount,
//             finalPrice: Math.round(finalPrice),
//             expiryTime: expiryTime.toISOString(), // ✅ String Format Guaranteed
//             isOfferActive: true,
//             isMember: true,
//             isLocked: false
//         });
//     }

//     // ✅ NUCLEAR FIX: Direct Database Update (Bypass Schema Validation)
//     if (newSeenEntries.length > 0) {
//         await User.updateOne(
//             { _id: userId },
//             { $push: { seenDrops: { $each: newSeenEntries } } }
//         );
//         console.log(`✅ Atomic Update: Added ${newSeenEntries.length} drops to seenDrops for ${user.name}`);
//     }
       
//     res.status(200).json({
//       success: true,
//       isMember: true,
//       drops: finalResponseDrops
//     });

//   } catch (err) {
//     console.error("List Drops Critical Error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };


// controllers/Api/dropControllerApi.js

  // 🔥 Cart model import karna mat bhoolna
exports.listDrops = async (req, res) => {
  try {
    const now = new Date();
    const userId = req.user.id || req.user._id;
    
    // 1. User fetch karo
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // 🔥 STEP 1: ARRAY CLEANUP (Easy Fix)
    // 24 ghante pehle ka time nikalo
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Sirf wahi drops rakho jo pichle 24 ghante mein dekhe gaye hain
    // Isse array hamesha chhoti rahegi (Clean up on the fly)
    let cleanedSeenDrops = (user.seenDrops || []).filter(item => 
        item.seenAt && new Date(item.seenAt) > oneDayAgo
    );

    const isMember = user.isMember && user.membershipExpiry && new Date(user.membershipExpiry) > now;

    // 2. Purchased/In-Cart logic (Wahi purana)
    const purchasedDropIds = await Order.find({ 
        user: userId, paymentStatus: "PAID", "items.itemType": "Drop" 
    }).distinct("items.itemId");

    const cart = await Cart.findOne({ user: userId });
    const inCartDropIds = cart ? cart.items
        .filter(item => item.itemType === "Drop")
        .map(item => item.itemId.toString()) : [];

    const hiddenDropIds = [...purchasedDropIds.map(id => id.toString()), ...inCartDropIds];

    // 3. Fetch Active Drops
    const allDrops = await Drop.find({ featured: true });
    const dropsToCheck = allDrops.filter(d => !hiddenDropIds.includes(d._id.toString()));

    // Membership Lock Logic
    if (!isMember) {
       const lockedDrops = dropsToCheck.map(drop => ({
          _id: drop._id, title: drop.title, image: drop.image,
          price: drop.price, finalPrice: drop.price, discount: 0,
          isLocked: true, message: "Members Only"
      }));
      return res.status(200).json({ success: true, isMember: false, drops: lockedDrops });
    }

    // 🕒 Timer Logic
    const finalResponseDrops = [];
    const seenMap = {};
    cleanedSeenDrops.forEach(item => {
        if (item.dropId) seenMap[item.dropId.toString()] = new Date(item.seenAt);
    });

    let needsUpdate = false;

    for (const drop of dropsToCheck) {
        const dropIdStr = drop._id.toString();
        let seenTime = seenMap[dropIdStr];

        if (!seenTime) {
            seenTime = new Date();
            cleanedSeenDrops.push({ dropId: drop._id, seenAt: seenTime });
            needsUpdate = true; // Naya drop dekha hai toh save karna padega
        }

        const expiryTime = new Date(seenTime.getTime() + 15 * 60 * 1000);
        if (now > expiryTime) continue; 

        const finalPrice = drop.discount > 0 ? drop.price * (1 - drop.discount / 100) : drop.price;

        finalResponseDrops.push({
            _id: drop._id,
            title: drop.title,
            image: drop.image,
            price: drop.price,
            discount: drop.discount,
            finalPrice: Math.round(finalPrice),
            expiryTime: expiryTime.toISOString(),
            isMember: true,
            isLocked: false
        });
    }

    // 🔥 STEP 2: SAVE CLEANED ARRAY
    // Agar array saaf hui hai ya naya drop add hua hai, toh update kar do
    // Hum direct array ko replace kar rahe hain ($set), push nahi!
    await User.updateOne(
        { _id: userId },
        { $set: { seenDrops: cleanedSeenDrops } }
    );
       
    res.status(200).json({ success: true, isMember: true, drops: finalResponseDrops });

  } catch (err) {
    console.error("List Drops Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
exports.getDailyDrop = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    const drop = await Drop.findOne(); // Ek hi drop hoga DB mein

    if (!drop) {
        return res.status(200).json({ success: true, status: "NO_DROP", message: "No drop available today." });
    }

    // 1. Membership Check
    const isMember = user.isMember && user.membershipExpiry > new Date();
    if (!isMember) {
        return res.status(200).json({
            success: true,
            status: "LOCKED_MEMBERSHIP", // Frontend: "Buy Membership" button dikhao
            drop: { ...drop.toObject(), price: drop.price, discount: 0 } // No discount shown
        });
    }

    // 2. Daily Status Check
    const todayStr = new Date().toISOString().split('T')[0]; // "2023-10-25"
    
    // Case A: Aaj pehli baar aaya hai
    if (user.dailyDrop.lastUnlockedDate !== todayStr) {
        return res.status(200).json({
            success: true,
            status: "LOCKED_DAILY", // Frontend: "Unlock Now" button dikhao
            drop: { title: "Mystery Drop", image: drop.image } // Thoda suspense
        });
    }

    // Case B: Aaj unlock kar chuka hai -> Time check karo
    const unlockTime = new Date(user.dailyDrop.unlockTime);
    const now = new Date();
    const diffMs = now - unlockTime;
    const diffMins = diffMs / (1000 * 60);

    if (diffMins > 15) {
        // 15 Min khatam
        return res.status(200).json({
            success: true,
            status: "EXPIRED", // Frontend: "Missed it! Come back tomorrow"
            message: "Today's drop expired for you."
        });
    }

    // Case C: Active hai (Timer chal raha hai)
    const timeLeftSeconds = Math.floor((15 * 60) - (diffMs / 1000));
    
    const finalPrice = drop.price - (drop.price * (drop.discount / 100));

    return res.status(200).json({
        success: true,
        status: "ACTIVE", // Frontend: Timer dikhao aur Buy button
        timeLeft: timeLeftSeconds,
        drop: {
            ...drop.toObject(),
            finalPrice: Math.round(finalPrice)
        }
    });

  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
// ---------------- GET SINGLE DROP ----------------
exports.getDrop = async (req, res) => {
  try {
    const drop = await Drop.findById(req.params.id);
    if (!drop) {
      return res.status(404).json({ success: false, message: "Drop not found" });
    }

    // Fetch user for membership check
    const user = await User.findById(req.user.id || req.user._id);
    const isMember = user && user.isMember && user.membershipExpiry > new Date();

    const finalPrice = isMember 
      ? drop.price * (1 - (drop.discount / 100)) 
      : drop.price;

    res.status(200).json({
      success: true,
      data: {
        ...drop.toObject(),
        isMember,
        finalPrice: parseFloat(finalPrice.toFixed(2))
      }
    });

  } catch (err) {
    console.error("Error in getDrop:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// ---------------- ADD DROP (Admin) ----------------
exports.addDrop = async (req, res) => {
  const { title, description, image, startTime, endTime, price, featured, discount } = req.body;
  
  try {
    const newDrop = new Drop({
      title,
      description,
      image,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      price: price || 0,
      discount: discount || 0,
      featured: featured === true || featured === "true" || featured === "on", 
    });

    await newDrop.save();

    res.status(201).json({
      success: true,
      message: "Drop created successfully",
      drop: newDrop
    });

  } catch (err) {
    console.error("Add Drop error:", err);
    res.status(500).json({ success: false, message: "Error creating drop", error: err.message });
  }
};

exports.unlockDrop = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    const todayStr = new Date().toISOString().split('T')[0];

    // Check Membership again (Security)
    if (!user.isMember) return res.status(403).json({ msg: "Membership required" });

    // Check agar aaj already unlock kiya hai
    if (user.dailyDrop.lastUnlockedDate === todayStr) {
        return res.status(400).json({ msg: "Already unlocked today" });
    }

    // ✅ SET TIMER
    user.dailyDrop.lastUnlockedDate = todayStr;
    user.dailyDrop.unlockTime = new Date(); // Abhi ka time note kar lo
    await user.save();

    res.status(200).json({ success: true, message: "Drop Unlocked! Timer Started." });

  } catch (err) {
    res.status(500).json({ success: false, msg: "Error unlocking" });
  }
};