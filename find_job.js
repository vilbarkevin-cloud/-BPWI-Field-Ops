import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function findJob() {
  const users = ["hF5sQ9qLpXWk2Z3Yx1Cv6Bn0M7r1", "vilbar.kevin@gmail.com"]; // Assuming vilbar.kevin@gmail.com has some uid. Wait, I'll need to fetch the uid or check all users.
  // We can just use the provided script to query admin
}
