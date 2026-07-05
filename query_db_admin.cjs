const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
initializeApp({ projectId: "ai-studio-f23e86db-38d2-472f-8a08-af7a652106ba" });
const db = getFirestore();

async function run() {
  try {
    const usersSnap = await db.collection("users").get();
    console.log(`Found ${usersSnap.docs.length} users.`);
    for (const userDoc of usersSnap.docs) {
      const actsSnap = await db.collection(`users/${userDoc.id}/activities`).get();
      actsSnap.forEach(act => {
        if (act.data().type === "meter_test") {
          console.log(`User ${userDoc.id} | Act ${act.id}:`, JSON.stringify(act.data().details, null, 2));
        }
      });
    }
  } catch (err) {
    console.error(err);
  }
}
run();
