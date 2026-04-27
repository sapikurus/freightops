import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBCAr82OYQ2vvUOj5C7x_AlE8Jf6kB6q7U",
  authDomain: "freightops-usi.firebaseapp.com",
  projectId: "freightops-usi",
  storageBucket: "freightops-usi.firebasestorage.app",
  messagingSenderId: "854427048001",
  appId: "1:854427048001:web:b3efdda074d033c57a4ec0",
};

const app  = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);
