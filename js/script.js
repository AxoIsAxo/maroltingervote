// js/script.js

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
    doc,
    getDoc,
    setDoc,
    runTransaction,
    deleteField,
    onSnapshot
} from "firebase/firestore";

// --- Firebase app, auth, db will be initialized by initApp() ---
let app;
let auth;
let db;

// --- DOM Elements (to be fetched inside initializeMainAppLogic or DOMContentLoaded) ---
let authContainer, loginView, registerView, showRegisterLink, showLoginLink,
    loginEmailInput, loginPasswordInput, loginButton,
    registerEmailInput, registerPasswordInput, registerButton,
    logoutButton, userInfoDisplay, userEmailSpan, authErrorP,
    mainContentWrapper, authRequiredMessage, verificationMessageP;

// --- Liking System Variables ---
let itemsData = {};
let userVotes = {};
let currentUserId = null;
let itemListeners = [];

const PREDEFINED_ITEMS_CONFIG = [
    { id: "POT", initialLikes: 0, initialDislikes: 0 },
    { id: "MAI", initialLikes: 0, initialDislikes: 0 },
    { id: "BAU", initialLikes: 0, initialDislikes: 0 },
];
const ALLOWED_DOMAIN = "maroltingergasse.at";


// Function to initialize everything AFTER config is confirmed AND DOM is ready
function initializeMainAppLogic() {
    console.log("%cinitializeMainAppLogic: Firebase config confirmed, proceeding.", "font-weight: bold;");

    // --- Initialize Firebase using the confirmed global config ---
    const firebaseConfig = window.firebaseConfigFromNetlify;

    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        console.log("Firebase initialized successfully within initializeMainAppLogic.");
    } catch (e) {
        console.error("CRITICAL: Firebase initialization FAILED within initializeMainAppLogic:", e);
        document.body.innerHTML = "<p style='color:red; font-size:18px; padding:20px;'>Error: App init failed (Firebase). Check console.</p>";
        return; // Stop if Firebase can't be initialized
    }

    // Get DOM Elements now that DOM is ready and Firebase is (or should be) init
    authContainer = document.getElementById('auth-container');
    loginView = document.getElementById('login-view');
    registerView = document.getElementById('register-view');
    showRegisterLink = document.getElementById('show-register-view');
    showLoginLink = document.getElementById('show-login-view');
    loginEmailInput = document.getElementById('login-email');
    loginPasswordInput = document.getElementById('login-password');
    loginButton = document.getElementById('login-button');
    registerEmailInput = document.getElementById('register-email');
    registerPasswordInput = document.getElementById('register-password');
    registerButton = document.getElementById('register-button');
    logoutButton = document.getElementById('logout-button');
    userInfoDisplay = document.getElementById('user-info');
    userEmailSpan = document.getElementById('user-email-display');
    authErrorP = document.getElementById('auth-error');
    mainContentWrapper = document.getElementById('main-content-wrapper');
    authRequiredMessage = document.getElementById('auth-required-message');

    // verificationMessageP is already created globally, just ensure it's referenceable
    // It was inserted into the DOM in the outer DOMContentLoaded listener.

    // Check if critical elements were found
    if (!loginButton || !authContainer || !mainContentWrapper || !userInfoDisplay || !registerButton || !logoutButton) {
        console.error("CRITICAL: One or more essential DOM elements for app logic were not found!");
        document.body.innerHTML = "<p style='color:red; font-size:18px; padding:20px;'>Error: UI elements missing. App cannot start.</p>";
        return; // Stop if UI is broken
    }

    // --- AUTHENTICATION LOGIC ---
    onAuthStateChanged(auth, async (user) => {
        console.log("%cON AUTH STATE CHANGED (main logic):", "color: blue; font-weight: bold;", user);
        if(authErrorP) authErrorP.textContent = ''; // Clear previous errors

        if (user) {
            console.log("onAuthStateChanged: User object present. Reloading user state...");
            try { await user.reload(); } catch (reloadError) { console.error("onAuthStateChanged: Error reloading user state:", reloadError); }
            const freshUser = auth.currentUser;
            console.log("onAuthStateChanged: Fresh user object:", freshUser);

            if (!freshUser) {
                console.log("onAuthStateChanged: User became null after reload. UI set to signed out.");
                authContainer.style.display = 'block'; loginView.style.display = 'block';
                registerView.style.display = 'none'; userInfoDisplay.style.display = 'none';
                mainContentWrapper.style.display = 'none'; authRequiredMessage.style.display = 'block';
                if(verificationMessageP) verificationMessageP.style.display = 'none';
                return;
            }

            if (freshUser.email && freshUser.email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)) {
                if (freshUser.emailVerified) {
                    console.log("%conAuthStateChanged: Access GRANTED for: " + freshUser.email, "color: green; font-weight: bold;");
                    authContainer.style.display = 'none'; userInfoDisplay.style.display = 'block';
                    userEmailSpan.textContent = freshUser.email; mainContentWrapper.style.display = 'block';
                    authRequiredMessage.style.display = 'none'; if(verificationMessageP) verificationMessageP.style.display = 'none';
                    initializeLikingSystem();
                } else {
                    console.log("onAuthStateChanged: Access PENDING VERIFICATION for:", freshUser.email);
                    authContainer.style.display = 'none'; userInfoDisplay.style.display = 'block';
                    userEmailSpan.textContent = `${freshUser.email} (Unverified)`;
                    mainContentWrapper.style.display = 'none'; authRequiredMessage.style.display = 'none';
                    if(verificationMessageP) {
                        verificationMessageP.innerHTML = `A verification email was sent to <strong>${freshUser.email}</strong>. Please verify. <button id="resend-verification-btn">Resend</button>`;
                        verificationMessageP.style.display = 'block';
                        const resendBtn = document.getElementById('resend-verification-btn');
                        if (resendBtn) {
                            resendBtn.onclick = () => {
                                sendEmailVerification(freshUser)
                                    .then(() => {
                                        verificationMessageP.innerHTML = `Verification email resent to <strong>${freshUser.email}</strong>. (Btn in 20s)`;
                                        setTimeout(() => {
                                            if(verificationMessageP.style.display === 'block' && auth.currentUser && !auth.currentUser.emailVerified) {
                                                verificationMessageP.innerHTML = `A verification email was sent to <strong>${freshUser.email}</strong>. Please verify. <button id="resend-verification-btn">Resend</button>`;
                                            }
                                        }, 20000);
                                    })
                                    .catch(error => { if(authErrorP) authErrorP.textContent = "Error resending: " + error.message; });
                            };
                        }
                    }
                }
            } else {
                console.warn("onAuthStateChanged: Access DENIED (wrong domain):", freshUser.email);
                if(authErrorP) authErrorP.textContent = `Access denied. Email must end with @${ALLOWED_DOMAIN}. Provided: ${freshUser.email || 'N/A'}`;
                signOut(auth).catch(err => console.error("Error signing out after domain denial:", err));
                authContainer.style.display = 'block'; loginView.style.display = 'block';
                registerView.style.display = 'none'; userInfoDisplay.style.display = 'none';
                mainContentWrapper.style.display = 'none'; authRequiredMessage.style.display = 'none';
                if(verificationMessageP) verificationMessageP.style.display = 'none';
            }
        } else {
            console.log("onAuthStateChanged: User is SIGNED OUT. UI set to signed out.");
            authContainer.style.display = 'block'; loginView.style.display = 'block';
            registerView.style.display = 'none'; userInfoDisplay.style.display = 'none';
            mainContentWrapper.style.display = 'none'; authRequiredMessage.style.display = 'block';
            if (verificationMessageP && !verificationMessageP.innerHTML.includes("Registration successful")) {
                verificationMessageP.style.display = 'none';
            }
        }
    });

    // --- Event Listeners for UI Toggles and Auth Actions ---
    if (showRegisterLink) showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); loginView.style.display = 'none'; registerView.style.display = 'block'; if(authErrorP) authErrorP.textContent = ''; if(verificationMessageP) verificationMessageP.style.display = 'none'; });
    if (showLoginLink) showLoginLink.addEventListener('click', (e) => { e.preventDefault(); registerView.style.display = 'none'; loginView.style.display = 'block'; if(authErrorP) authErrorP.textContent = ''; if(verificationMessageP) verificationMessageP.style.display = 'none'; });

    if (registerButton) {
        registerButton.addEventListener('click', () => {
            const email = registerEmailInput.value; const password = registerPasswordInput.value;
            if(authErrorP) authErrorP.textContent = ''; if(verificationMessageP) verificationMessageP.style.display = 'none';
            if (!email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)) { if(authErrorP) authErrorP.textContent = `Reg. only with @${ALLOWED_DOMAIN} emails.`; return; }
            if (password.length < 6) { if(authErrorP) authErrorP.textContent = "Password min. 6 characters."; return; }

            createUserWithEmailAndPassword(auth, email, password)
                .then((userCredential) => {
                    console.log("User registered:", userCredential.user.email);
                    return sendEmailVerification(userCredential.user)
                        .then(() => {
                            console.log("Verification email sent to", userCredential.user.email);
                            return signOut(auth);
                        });
                })
                .then(() => {
                    console.log("User signed out post-registration.");
                    loginView.style.display = 'block'; registerView.style.display = 'none';
                    if(authErrorP) authErrorP.textContent = '';
                    if(verificationMessageP) {
                        verificationMessageP.innerHTML = `Registration successful! Verify email for <strong>${email}</strong>, then log in.`;
                        verificationMessageP.style.display = 'block';
                    }
                    registerEmailInput.value = ''; registerPasswordInput.value = '';
                })
                .catch((error) => {
                    console.error("Registration/Email Error:", error.code, error.message);
                    if(authErrorP) authErrorP.textContent = (error.code === 'auth/email-already-in-use') ? "Email already registered. Log in." : "Reg. failed: " + error.message;
                });
        });
    }

    if (loginButton) {
        loginButton.addEventListener('click', () => {
            console.log("%cLOGIN BUTTON CLICKED", "color: orange; font-weight: bold;");
            const email = loginEmailInput.value; const password = loginPasswordInput.value;
            if(authErrorP) authErrorP.textContent = ''; if (verificationMessageP) verificationMessageP.style.display = 'none';
            signInWithEmailAndPassword(auth, email, password)
                .then((userCredential) => { console.log("%csignIn SUCCESS:", "color: green;", userCredential.user.email); })
                .catch((error) => {
                    console.error("%csignIn FAILED:", "color: red;", error.code, error.message);
                    if(authErrorP) authErrorP.textContent = (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') ? "Invalid email or password." : (error.code === 'auth/invalid-email') ? "Invalid email format." : "Login failed: " + error.message;
                });
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            if(authErrorP) authErrorP.textContent = ''; if(verificationMessageP) verificationMessageP.style.display = 'none';
            signOut(auth).then(() => {
                console.log("User signed out successfully.");
                itemListeners.forEach(unsubscribe => unsubscribe()); itemListeners = [];
                itemsData = {}; userVotes = {}; currentUserId = null;
                const mainContainer = document.querySelector('.main');
                if(mainContainer) mainContainer.innerHTML = ''; // Clear the items
            }).catch((error) => { if(authErrorP) authErrorP.textContent = "Logout error: " + error.message; });
        });
    }

    console.log("Main app event listeners and auth logic initialized.");
} // End of initializeMainAppLogic


// This part runs when script.js is parsed
console.log("script.js: Parsed. Waiting for DOMContentLoaded and Firebase config snippet.");

document.addEventListener('DOMContentLoaded', () => {
    console.log("script.js: DOMContentLoaded event fired.");
    console.log("script.js: Checking for window.firebaseConfigFromNetlify on DOMContentLoaded:", window.firebaseConfigFromNetlify);

    // Create and insert verificationMessageP into the DOM here, once.
    // It was declared globally, now ensure it's in the DOM.
    // verificationMessageP is already created, let's ensure it's inserted if it wasn't
    // This was previously outside DOMContentLoaded, which could be an issue if authContainer wasn't ready
    // Let's ensure it's correctly placed before authContainer if possible.
    const tempAuthContainer = document.getElementById('auth-container'); // Re-fetch for this scope
    if (!document.getElementById('verification-message')) { // Only insert if not already there
        if (tempAuthContainer && tempAuthContainer.parentNode) {
            tempAuthContainer.parentNode.insertBefore(verificationMessageP, tempAuthContainer);
        } else if (document.body && document.body.firstChild) { // Fallback to start of body
            document.body.insertBefore(verificationMessageP, document.body.firstChild);
        } else if (document.body) { // Fallback if no firstChild
             document.body.appendChild(verificationMessageP);
        }
    }


    if (window.firebaseConfigFromNetlify &&
        window.firebaseConfigFromNetlify.apiKey &&
        window.firebaseConfigFromNetlify.apiKey !== "" &&
        window.firebaseConfigFromNetlify.apiKey !== "{{ env.FIREBASE_API_KEY }}") {

        console.log("script.js: Firebase config FOUND and POPULATED on DOMContentLoaded. Calling initializeMainAppLogic().");
        initializeMainAppLogic();
    } else {
        console.warn("script.js: Firebase config NOT found/populated on DOMContentLoaded. Will try again in 500ms.");
        console.log("script.js: Current value of window.firebaseConfigFromNetlify:", window.firebaseConfigFromNetlify);

        setTimeout(() => {
            console.log("script.js: Checking for window.firebaseConfigFromNetlify after 500ms timeout.");
            console.log("script.js: Value after timeout:", window.firebaseConfigFromNetlify);
            if (window.firebaseConfigFromNetlify &&
                window.firebaseConfigFromNetlify.apiKey &&
                window.firebaseConfigFromNetlify.apiKey !== "" &&
                window.firebaseConfigFromNetlify.apiKey !== "{{ env.FIREBASE_API_KEY }}") {

                console.log("script.js: Firebase config FOUND and POPULATED after timeout. Calling initializeMainAppLogic().");
                initializeMainAppLogic();
            } else {
                console.error("CRITICAL (after timeout): Firebase configuration from Netlify NOT FOUND or not populated!");
                console.log("window.firebaseConfigFromNetlify (after timeout) is:", window.firebaseConfigFromNetlify);
                let errorDisplayArea = document.getElementById('auth-container') || document.body;
                errorDisplayArea.innerHTML = "<p style='color:red; font-size:18px; padding:20px;'>Error: Application configuration is missing. Please double-check Netlify environment variables and snippet injection settings, then ensure you've triggered a new deploy on Netlify.</p>" + (errorDisplayArea === document.body ? errorDisplayArea.innerHTML : "");
            }
        }, 500);
    }
});


// --- LIKING/RANKING SYSTEM FUNCTIONS (Must be accessible by initializeMainAppLogic) ---

function calculateInternalScore(likes, dislikes) {
    const rawLikeScore = calculateRawVoteScore(likes);
    const rawDislikeScore = calculateRawVoteScore(dislikes);
    return 5 + rawLikeScore - rawDislikeScore;
}

async function loadUserVotes() {
    if (!currentUserId) { console.log("loadUserVotes: No currentUserId."); userVotes = {}; return; }
    console.log("loadUserVotes: Loading for", currentUserId);
    const userVotesRef = doc(db, 'userVotes', currentUserId);
    try {
        const docSnap = await getDoc(userVotesRef);
        userVotes = (docSnap.exists() ? docSnap.data() : {}) || {}; // Ensure userVotes is an object
        console.log("loadUserVotes: Votes loaded:", userVotes);
    } catch (error) {
        console.error("Error loading user votes:", error);
        userVotes = {}; // Fallback to empty on error
        // Optionally re-throw if initializeLikingSystem should halt on this error
        // throw error;
    }
}

async function ensureItemDocExists(itemId, initialData) {
    console.log(`ensureItemDocExists: Checking for '${itemId}'`);
    const itemRef = doc(db, 'items', itemId);
    try {
        const docSnap = await getDoc(itemRef);
        if (!docSnap.exists()) {
            const dataToSet = {
                likes: initialData.initialLikes !== undefined ? initialData.initialLikes : 0,
                dislikes: initialData.initialDislikes !== undefined ? initialData.initialDislikes : 0,
            };
            await setDoc(itemRef, dataToSet);
            console.log(`ensureItemDocExists: Created item doc for ${itemId} with data:`, dataToSet);
            return dataToSet;
        }
        console.log(`ensureItemDocExists: Found existing doc for '${itemId}':`, docSnap.data());
        return docSnap.data();
    } catch (error) {
        console.error(`ensureItemDocExists: Error for item '${itemId}':`, error);
        return null; // Indicate failure to caller
    }
}

async function handleVote(itemId, newVoteType) {
    if (!currentUserId || !auth.currentUser || !auth.currentUser.emailVerified) { alert("Log in & verify email to vote."); return; }
    console.log(`handleVote: User ${currentUserId} voting '${newVoteType}' for item '${itemId}'`);
    const itemRef = doc(db, 'items', itemId);
    const userVotesRef = doc(db, 'userVotes', currentUserId);
    const previousUserVote = userVotes[itemId];

    // Optimistic UI Update
    const localItemBeforeVote = JSON.parse(JSON.stringify(itemsData[itemId] || {likes:0, dislikes:0, internalScore:5})); // Deep copy
    const localUserVotesBeforeVote = JSON.parse(JSON.stringify(userVotes)); // Deep copy

    userVotes[itemId] = (previousUserVote === newVoteType) ? null : newVoteType;
    if (!itemsData[itemId]) { // Should not happen if init is correct
        itemsData[itemId] = { likes: 0, dislikes: 0, internalScore: 5, element: document.querySelector(`.box[data-item-id="${itemId}"]`), h2Prefix: `${itemId}: `, originalOrder: PREDEFINED_ITEMS_CONFIG.findIndex(i => i.id === itemId)};
    }


    if (previousUserVote === newVoteType) { // Undoing vote
        if (newVoteType === 'like' && itemsData[itemId].likes > 0) itemsData[itemId].likes--;
        else if (newVoteType === 'dislike' && itemsData[itemId].dislikes > 0) itemsData[itemId].dislikes--;
    } else { // New vote or switching
        if (previousUserVote === 'like' && itemsData[itemId].likes > 0) itemsData[itemId].likes--;
        else if (previousUserVote === 'dislike' && itemsData[itemId].dislikes > 0) itemsData[itemId].dislikes--;
        if (newVoteType === 'like') itemsData[itemId].likes++;
        else itemsData[itemId].dislikes++;
    }
    itemsData[itemId].internalScore = calculateInternalScore(itemsData[itemId].likes, itemsData[itemId].dislikes);
    updateBoxDisplay(itemId);
    renderSortedBoxes();

    try {
        await runTransaction(db, async (transaction) => {
            const itemDocSnap = await transaction.get(itemRef);
            if (!itemDocSnap.exists()) throw new Error(`Item document ${itemId} does not exist!`); // Make it an Error object
            let currentLikes = itemDocSnap.data().likes || 0;
            let currentDislikes = itemDocSnap.data().dislikes || 0;
            let likeIncrement = 0; let dislikeIncrement = 0;

            if (previousUserVote === newVoteType) { // Un-voting
                if (newVoteType === 'like') likeIncrement = -1; else dislikeIncrement = -1;
            } else { // Voting or changing vote
                if (previousUserVote === 'like') likeIncrement = -1;
                else if (previousUserVote === 'dislike') dislikeIncrement = -1;
                if (newVoteType === 'like') likeIncrement += 1; else dislikeIncrement += 1;
            }
            const newLikes = Math.max(0, currentLikes + likeIncrement);
            const newDislikes = Math.max(0, currentDislikes + dislikeIncrement);
            transaction.update(itemRef, { likes: newLikes, dislikes: newDislikes });

            const userVoteUpdate = {};
            if (userVotes[itemId] === null) { // If un-voting
                userVoteUpdate[itemId] = deleteField();
            } else {
                userVoteUpdate[itemId] = userVotes[itemId];
            }
            transaction.set(userVotesRef, userVoteUpdate, { merge: true });
        });
        console.log(`Vote for ${itemId} (${newVoteType}) recorded in Firestore.`);
    } catch (error) {
        console.error("Vote transaction error for item " + itemId + ": ", error);
        alert("Failed to record vote. Your change has been reverted. Please try again.");
        // Revert optimistic UI update
        itemsData[itemId] = localItemBeforeVote;
        userVotes = localUserVotesBeforeVote;
        updateBoxDisplay(itemId);
        renderSortedBoxes();
    }
}

function getVoteValue(voteNumber) { if (voteNumber <= 0) return 0; if (voteNumber <= 10) return 0.1; if (voteNumber <= 20) return 0.05; if (voteNumber <= 30) return 0.025; if (voteNumber <= 50) return 0.01; return 0.005; }
function calculateRawVoteScore(count) { let score = 0; for (let i = 1; i <= count; i++) { score += getVoteValue(i); } return score; }

function updateBoxDisplay(itemId) {
    const item = itemsData[itemId];
    if (!item || !item.element) { console.warn("updateBoxDisplay: no item/element for", itemId, "itemsData:", itemsData); return; }
    const boxElement = item.element;
    const h2 = boxElement.querySelector('h2');
    const likeBtn = boxElement.querySelector('.like-btn');
    const dislikeBtn = boxElement.querySelector('.dislike-btn');
    const likesCountSpan = boxElement.querySelector('.likes-count');
    const dislikesCountSpan = boxElement.querySelector('.dislikes-count');

    item.internalScore = calculateInternalScore(item.likes, item.dislikes); // Recalculate just in case
    const displayScore = Math.max(0, Math.min(10, item.internalScore));

    if (h2) h2.textContent = `${item.h2Prefix}${displayScore.toFixed(1)}/10`;
    if (likesCountSpan) likesCountSpan.textContent = `(${item.likes < 0 ? 0 : item.likes})`;
    if (dislikesCountSpan) dislikesCountSpan.textContent = `(${item.dislikes < 0 ? 0 : item.dislikes})`;

    if (likeBtn) likeBtn.classList.remove('active-like');
    if (dislikeBtn) dislikeBtn.classList.remove('active-dislike');

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
// --- END LIKING SYSTEM FUNCTIONS ---
