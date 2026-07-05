const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, orderBy, limit } = require('firebase/firestore');

const firebaseConfig = {
  projectId: "ai-studio-f23e86db-38d2-472f-8a08-af7a652106ba",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const usersSnap = await getDocs(collection(db, "users"));
  for (const userDoc of usersSnap.docs) {
    const q = query(collection(db, `users/${userDoc.id}/activities`), orderBy("createdAt", "desc"), limit(2));
    const acts = await getDocs(q);
    acts.forEach(act => {
      if (act.data().type === "meter_test") {
        console.log(act.id, act.data().details);
      }
    });
  }
}
run();
