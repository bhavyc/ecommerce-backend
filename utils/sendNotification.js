const Notification = require("../models/Notification");
const User = require("../models/User");
const admin = require("firebase-admin");

// 🔥 Firebase Setup (Step 1 me jo file backend me daali thi, uska path yahan do)
const serviceAccount = require("../config/firebase-adminsdk.json"); 

// Firebase sirf ek baar initialize hona chahiye
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const sendNotification = async (userId, title, message, type) => {
  try {
    // 1. IN-APP NOTIFICATION (Ye hamesha chalega, DB me save hoga)
    await Notification.create({
      user: userId,
      title: title,
      message: message,
      type: type
    });
    console.log(`DB Notification saved for ${userId}: ${title}`);

    // 2. PUSH NOTIFICATION (Ye sirf tab chalega jab type "ORDER" hoga)
    if (type === "ORDER") {
      // User ko DB se dhundho taaki uska fcmToken mil sake
      const user = await User.findById(userId);
      
      if (user && user.fcmToken) {
        // Firebase ko message bhejne ki format
        const payload = {
  token: user.fcmToken,
  // 1. Notification object (Pop-up ke liye)
  notification: {
    title: title,
    body: message
  },
  // 2. Android specific settings (Priority ke liye)
  android: {
    priority: "high",
    notification: {
      channelId: "high_importance_channel", // 👈 Ye ID Flutter se match honi chahiye
      sound: "default",
      priority: "max",
      clickAction: "FLUTTER_NOTIFICATION_CLICK",
    }
  },
  // 3. Data object (App ke andar background logic ke liye)
  data: {
    type: type,
    orderId: userId.toString(), // Example data
  }
};
       

        // Firebase Admin ke through phone par Push bhej do
        await admin.messaging().send(payload);
        console.log(`📱 Push Notification Bhej di gayi: ${user.name} ko!`);
      }
    }
  } catch (err) {
    console.error("Error sending notification:", err);
  }
};

module.exports = sendNotification;



// const Notification = require("../models/Notification");

// const sendNotification = async (userId, title, message, type) => {
//   try {
//     await Notification.create({
//       user: userId,
//       title,
//       message,
//       type
//     });
//     console.log(`Notification sent to ${userId}: ${title}`);
//   } catch (err) {
//     console.error("Error creating notification:", err);
//   }
// };

// module.exports = sendNotification;