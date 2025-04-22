const { initializeApp } = require('firebase/app');
const { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    signOut
} = require('firebase/auth');
const { 
    getFirestore, 
    collection, 
    doc, 
    setDoc, 
    getDoc,
    query,
    where,
    getDocs,
    addDoc,
    orderBy,
    deleteDoc
} = require('firebase/firestore');
const { ref, uploadBytes, getDownloadURL, deleteObject } = require('firebase/storage');

// Default test credentials
const DEFAULT_CREDENTIALS = {
    teachers: [
        { id: 'T001', password: 'teacher123', name: 'shubham loshali' },
        { id: 'T002', password: 'teacher456', name: 'salman khan' }
    ],
    students: [
        { id: 'S001', password: 'student123', name: 'pawan bisht' },
        { id: 'S002', password: 'student456', name: 'nitin joshi' }
    ]
};

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = ref(app);

class FirebaseAuth {
    static async login(email, password, role) {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const firebaseUser = userCredential.user;
            
            // Get user data from Firestore
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                // Verify role matches
                if (userData.role !== role) {
                    await signOut(auth);
                    throw new Error('Invalid role for this account');
                }
                return {
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    role: userData.role,
                    name: userData.name
                };
            }
            throw new Error('User data not found');
        } catch (error) {
            throw new Error(error.message);
        }
    }

    static async register(email, password, userData) {
        try {
            // Check if email already exists
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '==', email));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                throw new Error('Email already registered');
            }

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Store additional user data in Firestore
            await setDoc(doc(db, 'users', user.uid), {
                email: email,
                role: userData.role,
                name: userData.name,
                createdAt: new Date().toISOString()
            });

            return {
                uid: user.uid,
                email: email,
                role: userData.role,
                name: userData.name
            };
        } catch (error) {
            throw new Error(error.message);
        }
    }

    static async resetPassword(email) {
        try {
            await sendPasswordResetEmail(auth, email);
            return true;
        } catch (error) {
            throw new Error(error.message);
        }
    }

    static async getUserData(uid) {
        try {
            const userDoc = await getDoc(doc(db, 'users', uid));
            if (userDoc.exists()) {
                return userDoc.data();
            }
            throw new Error('User data not found');
        } catch (error) {
            throw new Error(error.message);
        }
    }

    static async logout() {
        try {
            await signOut(auth);
            return true;
        } catch (error) {
            throw new Error(error.message);
        }
    }

    static async uploadFile(file, metadata) {
        try {
            const storageRef = ref(storage, `files/${metadata.uploadedBy}/${file.name}`);
            const uploadTask = await uploadBytes(storageRef, file, metadata);
            const downloadURL = await getDownloadURL(uploadTask.ref);
            
            // Store file metadata in Firestore
            await addDoc(collection(db, 'files'), {
                name: file.name,
                type: file.type,
                size: file.size,
                downloadURL,
                uploadedBy: metadata.uploadedBy,
                uploadedByName: metadata.uploadedByName,
                uploadedAt: new Date().toISOString(),
                description: metadata.description || '',
                subject: metadata.subject || '',
                class: metadata.class || ''
            });
            
            return downloadURL;
        } catch (error) {
            throw new Error(error.message);
        }
    }

    static async getFiles() {
        try {
            const filesRef = collection(db, 'files');
            const q = query(filesRef, orderBy('uploadedAt', 'desc'));
            const querySnapshot = await getDocs(q);
            
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            throw new Error(error.message);
        }
    }

    static async deleteFile(fileId) {
        try {
            const fileDoc = await getDoc(doc(db, 'files', fileId));
            if (!fileDoc.exists()) {
                throw new Error('File not found');
            }
            
            const fileData = fileDoc.data();
            const storageRef = ref(storage, fileData.downloadURL);
            
            // Delete from Storage
            await deleteObject(storageRef);
            
            // Delete from Firestore
            await deleteDoc(doc(db, 'files', fileId));
            
            return true;
        } catch (error) {
            throw new Error(error.message);
        }
    }
}

module.exports = FirebaseAuth; 