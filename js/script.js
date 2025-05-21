// --- Import necessary Firebase modules ---
import { initializeApp } from "firebase/app";
import {
    getAuth,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification,
    signOut
} from "firebase/auth";
import {
    getFirestore,
    collection,
    doc,
    getDoc,
    setDoc,
    runTransaction,
    FieldValue, // This might need to be imported as `deleteField` for deleting fields
    onSnapshot,
    deleteField // Use deleteField() to remove a field
} from "firebase/firestore";
// import { getAnalytics } from "firebase/analytics"; // Optional: if you want analytics

// --- Your web app's Firebase configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyDoo957xiZB2heugMso-C6oS1jSjciLUq0", // YOURS
  authDomain: "maroltingervote.firebaseapp.com",    // YOURS
  projectId: "maroltingervote",                     // YOURS
  storageBucket: "maroltingervote.appspot.com", // YOURS - corrected to .appspot.com
  messagingSenderId: "536390639151",                // YOURS
  appId: "1:536390639151:web:3f96ba960920552ecdb0da", // YOURS
  measurementId: "G-4TRS7E6NGK"                     // YOURS (Optional)
};

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app); // Use getAuth()
const db = getFirestore(app); // Use getFirestore()
// const analytics = getAnalytics(app); // Optional

document.addEventListener('DOMContentLoaded', () => {
    const ALLOWED_DOMAIN = "maroltingergasse.at";

    // DOM Elements
    const authContainer = document.getElementById('auth-container');
    const loginView = document.getElementById('login-view');
    const registerView = document.getElementById('register-view');
    const showRegisterLink = document.getElementById('show-register-view');
    const showLoginLink = document.getElementById('show-login-view');
    const loginEmailInput = document.getElementById('login-email');
    const loginPasswordInput = document.getElementById('login-password');
    const loginButton = document.getElementById('login-button');
    const registerEmailInput = document.getElementById('register-email');
    const registerPasswordInput = document.getElementById('register-password');
    const registerButton = document.getElementById('register-button');
    const logoutButton = document.getElementById('logout-button');
    const userInfoDisplay = document.getElementById('user-info');
    const userEmailSpan = document.getElementById('user-email-display');
    const authErrorP = document.getElementById('auth-error');
    const mainContentWrapper = document.getElementById('main-content-wrapper');
    const authRequiredMessage = document.getElementById('auth-required-message');

    const verificationMessageP = document.createElement('p');
    verificationMessageP.id = 'verification-message';
    verificationMessageP.className = 'info-message';
    verificationMessageP.style.display = 'none';
    if (authContainer && authContainer.parentNode) {
        authContainer.parentNode.insertBefore(verificationMessageP, authContainer);
    } else if (document.body) { // Fallback
        document.body.insertBefore(verificationMessageP, document.body.firstChild);
    }

    // --- AUTHENTICATION LOGIC ---
    onAuthStateChanged(auth, async (user) => { // Pass 'auth' as first argument
        console.log("onAuthStateChanged triggered. User:", user);
        authErrorP.textContent = '';

        if (user) {
            try {
                await user.reload();
            } catch (reloadError) {
                console.error("Error reloading user state:", reloadError);
            }
            const freshUser = auth.currentUser; // getAuth(app).currentUser
            console.log("Fresh user object:", freshUser);

            if (!freshUser) {
                authContainer.style.display = 'block'; loginView.style.display = 'block';
                registerView.style.display = 'none'; userInfoDisplay.style.display = 'none';
                mainContentWrapper.style.display = 'none'; authRequiredMessage.style.display = 'block';
                verificationMessageP.style.display = 'none';
                return;
            }

            if (freshUser.email && freshUser.email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)) {
                if (freshUser.emailVerified) {
                    console.log("Access GRANTED for:", freshUser.email);
                    authContainer.style.display = 'none'; userInfoDisplay.style.display = 'block';
                    userEmailSpan.textContent = freshUser.email; mainContentWrapper.style.display = 'block';
                    authRequiredMessage.style.display = 'none'; verificationMessageP.style.display = 'none';
                    initializeLikingSystem();
                } else {
                    console.log("Access PENDING VERIFICATION for:", freshUser.email);
                    authContainer.style.display = 'none'; userInfoDisplay.style.display = 'block';
                    userEmailSpan.textContent = `${freshUser.email} (Unverified)`;
                    mainContentWrapper.style.display = 'none'; authRequiredMessage.style.display = 'none';
                    verificationMessageP.innerHTML = `A verification email was sent to <strong>${freshUser.email}</strong>. Please verify your email to access content. <button id="resend-verification-btn">Resend Email</button>`;
                    verificationMessageP.style.display = 'block';
                    const resendBtn = document.getElementById('resend-verification-btn');
                    if (resendBtn) {
                        resendBtn.onclick = () => {
                            sendEmailVerification(freshUser) // Pass 'freshUser'
                                .then(() => {
                                    verificationMessageP.innerHTML = `Verification email resent to <strong>${freshUser.email}</strong>. (Button will reappear shortly)`;
                                    setTimeout(() => {
                                        if(verificationMessageP.style.display === 'block' && auth.currentUser && !auth.currentUser.emailVerified) {
                                            verificationMessageP.innerHTML = `A verification email was sent to <strong>${freshUser.email}</strong>. Please verify your email to access content. <button id="resend-verification-btn">Resend Email</button>`;
                                        }
                                    }, 20000);
                                })
                                .catch(error => { authErrorP.textContent = "Error resending: " + error.message; });
                        };
                    }
                }
            } else {
                console.warn("Access DENIED (wrong domain):", freshUser.email);
                authErrorP.textContent = `Access denied. Email must end with @${ALLOWED_DOMAIN}. You provided: ${freshUser.email || 'N/A'}`;
                authContainer.style.display = 'block'; loginView.style.display = 'block';
                registerView.style.display = 'none'; userInfoDisplay.style.display = 'none';
                mainContentWrapper.style.display = 'none'; authRequiredMessage.style.display = 'none';
                verificationMessageP.style.display = 'none';
                signOut(auth).catch(err => console.error("Error signing out:", err)); // Pass 'auth'
            }
        } else {
            console.log("User is SIGNED OUT.");
            authContainer.style.display = 'block'; loginView.style.display = 'block';
            registerView.style.display = 'none'; userInfoDisplay.style.display = 'none';
            mainContentWrapper.style.display = 'none'; authRequiredMessage.style.display = 'block';
            if (!verificationMessageP.innerHTML.includes("Registration successful")) {
                verificationMessageP.style.display = 'none';
            }
        }
    });

    showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); loginView.style.display = 'none'; registerView.style.display = 'block'; authErrorP.textContent = ''; verificationMessageP.style.display = 'none'; });
    showLoginLink.addEventListener('click', (e) => { e.preventDefault(); registerView.style.display = 'none'; loginView.style.display = 'block'; authErrorP.textContent = ''; verificationMessageP.style.display = 'none'; });

    registerButton.addEventListener('click', () => {
        const email = registerEmailInput.value;
        const password = registerPasswordInput.value;
        authErrorP.textContent = ''; verificationMessageP.style.display = 'none';
        if (!email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)) { authErrorP.textContent = `Reg. only with @${ALLOWED_DOMAIN} emails.`; return; }
        if (password.length < 6) { authErrorP.textContent = "Password min. 6 characters."; return; }

        createUserWithEmailAndPassword(auth, email, password) // Pass 'auth'
            .then((userCredential) => {
                console.log("User registered:", userCredential.user.email);
                return sendEmailVerification(userCredential.user) // Pass 'userCredential.user'
                    .then(() => {
                        console.log("Verification email sent to", userCredential.user.email);
                        return signOut(auth); // Pass 'auth'
                    });
            })
            .then(() => {
                console.log("User signed out post-registration.");
                loginView.style.display = 'block'; registerView.style.display = 'none';
                authErrorP.textContent = '';
                verificationMessageP.innerHTML = `Registration successful! Verify email for <strong>${email}</strong>, then log in.`;
                verificationMessageP.style.display = 'block';
                registerEmailInput.value = ''; registerPasswordInput.value = '';
            })
            .catch((error) => {
                console.error("Registration/Email Error:", error.code, error.message);
                authErrorP.textContent = (error.code === 'auth/email-already-in-use') ? "Email already registered. Please log in." : "Reg. failed: " + error.message;
            });
    });

    loginButton.addEventListener('click', () => {
        const email = loginEmailInput.value;
        const password = loginPasswordInput.value;
        authErrorP.textContent = ''; verificationMessageP.style.display = 'none';

        signInWithEmailAndPassword(auth, email, password) // Pass 'auth'
            .then((userCredential) => { console.log("Login attempt success:", userCredential.user.email); })
            .catch((error) => {
                console.error("Login error:", error.code, error.message);
                authErrorP.textContent = (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') ? "Invalid email or password." : "Login failed: " + error.message;
            });
    });

    logoutButton.addEventListener('click', () => {
        authErrorP.textContent = ''; verificationMessageP.style.display = 'none';
        signOut(auth).then(() => { // Pass 'auth'
            console.log("User signed out successfully.");
            itemListeners.forEach(unsubscribe => unsubscribe()); itemListeners = [];
            itemsData = {}; userVotes = {}; currentUserId = null;
            const mainContainer = document.querySelector('.main');
            if(mainContainer) mainContainer.innerHTML = '';
        }).catch((error) => { authErrorP.textContent = error.message; });
    });

    // --- LIKING/RANKING SYSTEM with FIRESTORE ---
    let itemsData = {}; let userVotes = {}; let currentUserId = null; let itemListeners = [];
    const PREDEFINED_ITEMS_CONFIG = [
        { id: "POT", initialLikes: 0, initialDislikes: 0 },
        { id: "MAI", initialLikes: 0, initialDislikes: 0 },
        { id: "BAU", initialLikes: 0, initialDislikes: 0 },
    ];

    function calculateInternalScore(likes, dislikes) {
        const rawLikeScore = calculateRawVoteScore(likes);
        const rawDislikeScore = calculateRawVoteScore(dislikes);
        return 5 + rawLikeScore - rawDislikeScore;
    }

    async function loadUserVotes() {
        if (!currentUserId) { userVotes = {}; return; }
        const userVotesRef = doc(db, 'userVotes', currentUserId); // Use modular 'doc'
        try {
            const docSnap = await getDoc(userVotesRef); // Use modular 'getDoc'
            userVotes = (docSnap.exists() ? docSnap.data() : {}) || {};
        } catch (error) { console.error("Error loading user votes:", error); userVotes = {}; }
    }

    async function ensureItemDocExists(itemId, initialData) {
        const itemRef = doc(db, 'items', itemId); // Use modular 'doc'
        const docSnap = await getDoc(itemRef);    // Use modular 'getDoc'
        if (!docSnap.exists()) {
            try {
                const dataToSet = { likes: initialData.initialLikes || 0, dislikes: initialData.initialDislikes || 0 };
                await setDoc(itemRef, dataToSet); // Use modular 'setDoc'
                console.log(`Created item doc for ${itemId}`);
                return dataToSet;
            } catch (error) { console.error(`Error creating item doc for ${itemId}:`, error); return null; }
        }
        return docSnap.data();
    }

    async function initializeLikingSystem() {
        console.log("--- initializeLikingSystem CALLED ---");
        if (auth.currentUser && auth.currentUser.emailVerified) {
            currentUserId = auth.currentUser.uid;
        } else {
            mainContentWrapper.style.display = 'none';
            authRequiredMessage.style.display = auth.currentUser && !auth.currentUser.emailVerified ? 'none' : 'block';
            return;
        }

        itemListeners.forEach(unsubscribe => unsubscribe()); itemListeners = [];
        try { await loadUserVotes(); } catch (e) { userVotes = {}; }

        const mainContainer = document.querySelector('.main');
        if (!mainContainer) { console.error("'.main' container not found."); return; }
        mainContainer.innerHTML = ''; itemsData = {};

        for (const pItemConfig of PREDEFINED_ITEMS_CONFIG) {
            const itemId = pItemConfig.id; const h2Prefix = `${itemId}: `;
            const firestoreItemData = await ensureItemDocExists(itemId, pItemConfig);
            if (!firestoreItemData) { console.warn(`Skipping item ${itemId}`); continue; }

            const boxElement = document.createElement('div'); boxElement.className = 'box'; boxElement.dataset.itemId = itemId;
            const h2 = document.createElement('h2');
            const voteControls = document.createElement('div'); voteControls.className = 'vote-controls';
            voteControls.innerHTML = `<button class="like-btn">👍<span class="likes-count">(0)</span></button><button class="dislike-btn">👎<span class="dislikes-count">(0)</span></button>`;
            boxElement.appendChild(h2); boxElement.appendChild(voteControls); mainContainer.appendChild(boxElement);

            itemsData[itemId] = {
                likes: firestoreItemData.likes, dislikes: firestoreItemData.dislikes,
                internalScore: calculateInternalScore(firestoreItemData.likes, firestoreItemData.dislikes),
                h2Prefix: h2Prefix, originalOrder: PREDEFINED_ITEMS_CONFIG.findIndex(item => item.id === itemId), element: boxElement
            };
            voteControls.querySelector('.like-btn').addEventListener('click', () => handleVote(itemId, 'like'));
            voteControls.querySelector('.dislike-btn').addEventListener('click', () => handleVote(itemId, 'dislike'));
            updateBoxDisplay(itemId);

            const itemRef = doc(db, 'items', itemId); // Use modular 'doc'
            const unsubscribe = onSnapshot(itemRef, (docSnap) => { // Use modular 'onSnapshot'
                console.log(`Realtime update for ${itemId}:`, docSnap.data());
                if (docSnap.exists()) {
                    const updatedData = docSnap.data();
                    if (itemsData[itemId] && (itemsData[itemId].likes !== updatedData.likes || itemsData[itemId].dislikes !== updatedData.dislikes)) {
                        itemsData[itemId].likes = updatedData.likes; itemsData[itemId].dislikes = updatedData.dislikes;
                        itemsData[itemId].internalScore = calculateInternalScore(updatedData.likes, updatedData.dislikes);
                        updateBoxDisplay(itemId); renderSortedBoxes();
                    }
                }
            }, error => { console.error(`Error listening to item ${itemId}:`, error); });
            itemListeners.push(unsubscribe);
        }
        renderSortedBoxes(); console.log("Liking system: Initialization complete.");
    }

    async function handleVote(itemId, newVoteType) {
        if (!currentUserId || !auth.currentUser || !auth.currentUser.emailVerified) { alert("Log in & verify email to vote."); return; }
        const itemRef = doc(db, 'items', itemId); // Use modular 'doc'
        const userVotesRef = doc(db, 'userVotes', currentUserId); // Use modular 'doc'
        const previousUserVote = userVotes[itemId];
        const localItemBeforeVote = { ...itemsData[itemId] }; const localUserVotesBeforeVote = { ...userVotes };

        userVotes[itemId] = (previousUserVote === newVoteType) ? null : newVoteType;
        if (previousUserVote === newVoteType) {
            if (newVoteType === 'like') itemsData[itemId].likes--; else itemsData[itemId].dislikes--;
        } else {
            if (previousUserVote === 'like') itemsData[itemId].likes--; else if (previousUserVote === 'dislike') itemsData[itemId].dislikes--;
            if (newVoteType === 'like') itemsData[itemId].likes++; else itemsData[itemId].dislikes++;
        }
        itemsData[itemId].internalScore = calculateInternalScore(itemsData[itemId].likes, itemsData[itemId].dislikes);
        updateBoxDisplay(itemId); renderSortedBoxes();

        try {
            await runTransaction(db, async (transaction) => { // Pass 'db'
                const itemDocSnap = await transaction.get(itemRef); // Use 'transaction.get'
                if (!itemDocSnap.exists()) throw "Item document does not exist!";
                let currentLikes = itemDocSnap.data().likes || 0; let currentDislikes = itemDocSnap.data().dislikes || 0;
                let likeIncrement = 0; let dislikeIncrement = 0;
                if (previousUserVote === newVoteType) {
                    if (newVoteType === 'like') likeIncrement = -1; else dislikeIncrement = -1;
                } else {
                    if (previousUserVote === 'like') likeIncrement = -1; else if (previousUserVote === 'dislike') dislikeIncrement = -1;
                    if (newVoteType === 'like') likeIncrement += 1; else dislikeIncrement += 1;
                }
                const newLikes = Math.max(0, currentLikes + likeIncrement); const newDislikes = Math.max(0, currentDislikes + dislikeIncrement);
                transaction.update(itemRef, { likes: newLikes, dislikes: newDislikes }); // Use 'transaction.update'
                const userVoteUpdate = {};
                if (userVotes[itemId] === null) { userVoteUpdate[itemId] = deleteField(); } // Use 'deleteField()'
                else { userVoteUpdate[itemId] = userVotes[itemId]; }
                transaction.set(userVotesRef, userVoteUpdate, { merge: true }); // Use 'transaction.set'
            });
            console.log(`Vote for ${itemId} (${newVoteType}) recorded in Firestore.`);
        } catch (error) {
            console.error("Error processing vote transaction: ", error); alert("Failed to record vote.");
            itemsData[itemId] = localItemBeforeVote; userVotes = localUserVotesBeforeVote;
            updateBoxDisplay(itemId); renderSortedBoxes();
        }
    }

    function getVoteValue(voteNumber) { if (voteNumber <= 0) return 0; if (voteNumber <= 10) return 0.1; if (voteNumber <= 20) return 0.05; if (voteNumber <= 30) return 0.025; if (voteNumber <= 50) return 0.01; return 0.005; }
    function calculateRawVoteScore(count) { let score = 0; for (let i = 1; i <= count; i++) { score += getVoteValue(i); } return score; }
    function updateBoxDisplay(itemId) {
        const item = itemsData[itemId]; if (!item || !item.element) return;
        const boxElement = item.element; const h2 = boxElement.querySelector('h2');
        const likeBtn = boxElement.querySelector('.like-btn'); const dislikeBtn = boxElement.querySelector('.dislike-btn');
        const likesCountSpan = boxElement.querySelector('.likes-count'); const dislikesCountSpan = boxElement.querySelector('.dislikes-count');
        const displayScore = Math.max(0, Math.min(10, item.internalScore));
        if (h2) h2.textContent = `${item.h2Prefix}${displayScore.toFixed(1)}/10`;
        if (likesCountSpan) likesCountSpan.textContent = `(${item.likes < 0 ? 0 : item.likes})`;
        if (dislikesCountSpan) dislikesCountSpan.textContent = `(${item.dislikes < 0 ? 0 : item.dislikes})`;
        if (likeBtn) likeBtn.classList.remove('active-like'); if (dislikeBtn) dislikeBtn.classList.remove('active-dislike');
        const currentUserSpecificVote = userVotes[itemId];
        if (currentUserSpecificVote === 'like' && likeBtn) { likeBtn.classList.add('active-like'); }
        else if (currentUserSpecificVote === 'dislike' && dislikeBtn) { dislikeBtn.classList.add('active-dislike'); }
    }
    function renderSortedBoxes() {
        const mainContainer = document.querySelector('.main'); if (!mainContainer) return;
        const itemsArray = Object.values(itemsData).filter(item => item && item.element);
        itemsArray.sort((a, b) => {
            if (b.internalScore !== a.internalScore) { return b.internalScore - a.internalScore; }
            return a.originalOrder - b.originalOrder;
        });
        itemsArray.forEach(item => { mainContainer.appendChild(item.element); });
    }
}); // End of DOMContentLoaded