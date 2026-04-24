const GroupBuy = require("../../models/GroupBuy");
const Deal = require("../../models/24HrDeal");
const Order = require("../../models/Order");

//  1. START A NEW GROUP
exports.startGroup = async (req, res) => {
  try {
    const userId = req.user._id; // From Auth Middleware
    const { dealId, addressData, paymentMethod } = req.body;

    // 1. Fetch Deal and Validate
    const deal = await Deal.findById(dealId);
    if (!deal) {
      return res.status(404).json({ success: false, message: "Deal not found" });
    }
    if (!deal.isGroupBuyAvailable) {
      return res.status(400).json({ success: false, message: "Group buy is not available for this item" });
    }

    // 2. Create the "Pending" Order for the Leader
    // Note: In a real app, you might want to process payment authorization here first
    const newOrder = new Order({
      user: userId,
      items: [{
        itemId: deal._id,
        itemType: "24HrDeal",
        title: deal.title,
        price: deal.groupPrice, // 🔥 Uses Lower Group Price
        quantity: 1,
        image: deal.image
      }],
      totalAmount: deal.groupPrice,
      shippingAddress: addressData, 
      paymentMethod: paymentMethod,
      orderStatus: "Group_Pending", // ⏳ Waiting for group to fill
      paymentStatus: "PENDING"
    });
    
    await newOrder.save();

    // 3. Create the Group Lobby
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 Hours from now

    const newGroup = new GroupBuy({
      deal: deal._id,
      members: [{ user: userId, orderId: newOrder._id }],
      requiredSize: deal.groupSize,
      expiresAt: expiresAt,
      status: "OPEN"
    });

    await newGroup.save();

    res.status(201).json({
      success: true,
      message: "Group started successfully",
      groupId: newGroup._id,
      orderId: newOrder._id
    });

  } catch (err) {
    console.error("Start Group Error:", err);
    res.status(500).json({ success: false, message: "Error starting group", error: err.message });
  }
};

// 🟢 2. JOIN AN EXISTING GROUP
exports.joinGroup = async (req, res) => {
  try {
    const userId = req.user._id;
    const { groupId, addressData, paymentMethod } = req.body;

    // 1. Fetch Group
    const group = await GroupBuy.findById(groupId).populate("deal");
    
    // Validations
    if (!group) return res.status(404).json({ success: false, message: "Group not found" });
    if (group.status !== "OPEN") return res.status(400).json({ success: false, message: "Group is closed or expired" });
    if (new Date() > group.expiresAt) return res.status(400).json({ success: false, message: "Group expired" });

    // Check if user is already in the group
    const alreadyJoined = group.members.some(m => m.user.toString() === userId.toString());
    if (alreadyJoined) {
      return res.status(400).json({ success: false, message: "You are already in this group" });
    }

    // 2. Create Order for this new Member
    const newOrder = new Order({
      user: userId,
      items: [{
        itemId: group.deal._id,
        itemType: "24HrDeal",
        title: group.deal.title,
        price: group.deal.groupPrice,
        quantity: 1,
        image: group.deal.image
      }],
      totalAmount: group.deal.groupPrice,
      shippingAddress: addressData,
      paymentMethod: paymentMethod,
      orderStatus: "Group_Pending",
      paymentStatus: "PENDING"
    });
    await newOrder.save();

    // 3. Add to Group
    group.members.push({ user: userId, orderId: newOrder._id });
    await group.save();

    // 4. 🏁 CHECK IF GROUP IS FULL (Winning Logic)
    let isCompleted = false;

    if (group.members.length >= group.requiredSize) {
      group.status = "COMPLETED";
      await group.save();

      // Update ALL orders in this group to "Processing"
      const orderIds = group.members.map(m => m.orderId);
      await Order.updateMany(
        { _id: { $in: orderIds } },
        { 
          orderStatus: "Processing", 
          paymentStatus: "PAID" // Assuming logic handles payment capture here
        }
      );
      isCompleted = true;
    }

    res.status(200).json({
      success: true,
      message: isCompleted ? "Group completed! Order processed." : "Joined group successfully",
      isCompleted: isCompleted,
      group
    });

  } catch (err) {
    console.error("Join Group Error:", err);
    res.status(500).json({ success: false, message: "Error joining group", error: err.message });
  }
};

// 🟢 3. VIEW LOBBY (Lobby Status)
exports.viewLobby = async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await GroupBuy.findById(groupId)
      .populate("deal")
      .populate("members.user", "name email"); // Only fetch necessary user fields

    if (!group) {
      return res.status(404).json({ success: false, message: "Lobby not found" });
    }

    const slotsLeft = Math.max(0, group.requiredSize - group.members.length);
    
    // Construct a shareable link (Frontend should handle the UI)
    const shareLink = `${req.protocol}://${req.get('host')}/group/join/${group._id}`;

    res.status(200).json({
      success: true,
      data: {
        group,
        slotsLeft,
        isFull: slotsLeft === 0,
        shareLink
      }
    });

  } catch (err) {
    console.error("Lobby Error:", err);
    res.status(500).json({ success: false, message: "Error loading lobby" });
  }
};