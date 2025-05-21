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
// verificationMessageP is declared here, but created and assigned in DOMContentLoaded
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
        return;
    }

    // Get DOM Elements now that DOM is ready and Firebase is init
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
    // verificationMessageP should have been created and inserted by the DOMContentLoaded listener

    if (!loginButton || !authContainer || !mainContentWrapper || !userInfoDisplay || !registerButton || !logoutButton || !verificationMessageP) {
        console.error("CRITICAL: One or more essential DOM elements for app logic were not found or verificationMessageP not ready!");
        // Avoid overwriting body if verificationMessageP is the only issue and it logs its own creation problem
        if(!verificationMessageP) document.body.innerHTML = "<p style='color:red; font-size:18px; padding:20px;'>Error: UI elements missing. App cannot start.</p>";
        return;
    }

    // --- AUTHENTICATION LOGIC ---
    onAuthStateChanged(auth, async (user) => {
        console.log("%cON AUTH STATE CHANGED (main logic):", "color: blue; font-weight: bold;", user);
        if(authErrorP) authErrorP.textContent = '';

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
                                            if(verificationMessageP && verificationMessageP.style.display === 'block' && auth.currentUser && !auth.currentUser.emailVerified) {
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
                if(mainContainer) mainContainer.innerHTML = '';
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

    // --- CREATE and INSERT verificationMessageP ---
    if (!document.getElementById('verification-message')) {
        verificationMessageP = document.createElement('p'); // Assign to the globally declared variable
        verificationMessageP.id = 'verification-message';
        verificationMessageP.className = 'info-message';
        verificationMessageP.style.display = 'none';

        const tempAuthContainer = document.getElementById('auth-container');
        if (tempAuthContainer && tempAuthContainer.parentNode) {
            tempAuthContainer.parentNode.insertBefore(verificationMessageP, tempAuthContainer);
            console.log("verificationMessageP inserted before auth-container.");
        } else if (document.body && document.body.firstChild) {
            document.body.insertBefore(verificationMessageP, document.body.firstChild);
            console.log("verificationMessageP inserted at start of body (fallback).");
        } else if (document.body) {
            document.body.appendChild(verificationMessageP);
            console.log("verificationMessageP appended to body (fallback).");
        } else {
            console.error("Could not find a place to insert verificationMessageP!");
        }
    } else {
        verificationMessageP = document.getElementById('verification-message'); // Get ref if already exists
        console.log("verificationMessageP already exists in DOM.");
    }

    // --- Check for Firebase Config and Initialize App Logic ---
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
                errorDisplayArea.innerHTML = "<p style='color:red; font-size:18px; padding:20px;'>Error: Application configuration is missing. Please double-check Netlify environment variables and snippet injection settings, then ensure you've triggered a new deploy on Netlify.</p>" + (errorDisplayArea === document.body ? "" : errorDisplayArea.innerHTML); // Avoid duplicating body content
            }
        }, 500);
    }
});

// --- LIKING/RANKING SYSTEM FUNCTIONS (Must be accessible by initializeMainAppLogic) ---
async function initializeLikingSystem() {
    console.log("%c--- initializeLikingSystem CALLED ---", "color: purple; font-weight: bold;");
    if (auth.currentUser && auth.currentUser.emailVerified) {
        currentUserId = auth.currentUser.uid;
        console.log("initializeLikingSystem: User is valid. UID:", currentUserId);
    } else {
        console.error("initializeLikingSystem: Pre-condition not met (user not logged in or verified). Aborting.");
        if(mainContentWrapper) mainContentWrapper.style.display = 'none';
        if(authRequiredMessage) authRequiredMessage.style.display = auth.currentUser && !auth.currentUser.emailVerified ? 'none' : 'block';
        return;
    }

    itemListeners.forEach(unsubscribe => unsubscribe()); itemListeners = [];
    try {
        await loadUserVotes();
        console.log("initializeLikingSystem: User votes loaded:", userVotes);
    } catch (e) { console.error("initializeLikingSystem: Error during loadUserVotes:", e); userVotes = {}; }

    const mainContainer = document.querySelector('.main');
    if (!mainContainer) { console.error("initializeLikingSystem: CRITICAL - '.main' container NOT FOUND."); return; }
    console.log("initializeLikingSystem: '.main' container found. Clearing content.");
    mainContainer.innerHTML = ''; itemsData = {};

    console.log("initializeLikingSystem: Processing PREDEFINED_ITEMS_CONFIG. Count:", PREDEFINED_ITEMS_CONFIG.length);
    if (PREDEFINED_ITEMS_CONFIG.length === 0) console.warn("initializeLikingSystem: PREDEFINED_ITEMS_CONFIG is empty.");

    for (const pItemConfig of PREDEFINED_ITEMS_CONFIG) {
        const itemId = pItemConfig.id; const h2Prefix = `${itemId}: `;
        console.log(`initializeLikingSystem: Processing item '${itemId}'`);

        const firestoreItemData = await ensureItemDocExists(itemId, pItemConfig);
        if (!firestoreItemData) { console.warn(`initializeLikingSystem: Skipping item '${itemId}' - no Firestore data.`); continue; }
        console.log(`initializeLikingSystem: Firestore data for '${itemId}':`, firestoreItemData);

        const boxElement = document.createElement('div'); boxElement.className = 'box'; boxElement.dataset.itemId = itemId;
        const h2 = document.createElement('h2');
        const voteControls = document.createElement('div'); voteControls.className = 'vote-controls';
        voteControls.innerHTML = `<button class="like-btn" aria-label="Like">👍<span class="likes-count">(0)</span></button><button class="dislike-btn" aria-label="Dislike">👎<span class="dislikes-count">(0)</span></button>`;
        boxElement.appendChild(h2); boxElement.appendChild(voteControls);
        mainContainer.appendChild(boxElement);
        console.log(`initializeLikingSystem: Appended box for '${itemId}'.`);

        itemsData[itemId] = {
            likes: firestoreItemData.likes, dislikes: firestoreItemData.dislikes,
            internalScore: calculateInternalScore(firestoreItemData.likes, firestoreItemData.dislikes),
            h2Prefix: h2Prefix, originalOrder: PREDEFINED_ITEMS_CONFIG.findIndex(item => item.id === itemId), element: boxElement
        };
        voteControls.querySelector('.like-btn').addEventListener('click', () => handleVote(itemId, 'like'));
        voteControls.querySelector('.dislike-btn').addEventListener('click', () => handleVote(itemId, 'dislike'));
        updateBoxDisplay(itemId);

        const itemRef = doc(db, 'items', itemId);
        const unsubscribe = onSnapshot(itemRef, (docSnap) => {
            // console.log(`Realtime update for ${itemId}:`, docSnap.data()); // Can be noisy
            if (docSnap.exists()) {
                const updatedData = docSnap.data();
                if (itemsData[itemId] && (itemsData[itemId].likes !== updatedData.likes || itemsData[itemId].dislikes !== updatedData.dislikes)) {
                    console.log(`Applying realtime update for ${itemId}`);
                    itemsData[itemId].likes = updatedData.likes; itemsData[itemId].dislikes = updatedData.dislikes;
                    itemsData[itemId].internalScore = calculateInternalScore(updatedData.likes, updatedData.dislikes);
                    updateBoxDisplay(itemId); renderSortedBoxes();
                }
            }
        }, error => { console.error(`Error listening to item ${itemId}:`, error); });
        itemListeners.push(unsubscribe);
    }
    renderSortedBoxes();
    console.log("initializeLikingSystem: Initialization complete. Final itemsData:", itemsData);
}

async function loadUserVotes() {
    if (!currentUserId) { console.log("loadUserVotes: No currentUserId."); userVotes = {}; return; }
    console.log("loadUserVotes: Loading for", currentUserId);
    const userVotesRef = doc(db, 'userVotes', currentUserId);
    try {
        const docSnap = await getDoc(userVotesRef);
        userVotes = (docSnap.exists() ? docSnap.data() : {}) || {};
        console.log("loadUserVotes: Votes loaded:", userVotes);
    } catch (error) { console.error("Error loading user votes:", error); userVotes = {}; throw error; }
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
        return null;
    }
}

async function handleVote(itemId, newVoteType) {
    if (!currentUserId || !auth.currentUser || !auth.currentUser.emailVerified) { alert("Log in & verify email to vote."); return; }
    console.log(`handleVote: User ${currentUserId} voting '${newVoteType}' for item '${itemId}'`);
    const itemRef = doc(db, 'items', itemId);
    const userVotesRef = doc(db, 'userVotes', currentUserId);
    const previousUserVote = userVotes[itemId];

    const localItemBeforeVote = JSON.parse(JSON.stringify(itemsData[itemId] || {likes:0, dislikes:0, internalScore:5, element: null, h2Prefix: `${itemId}: `, originalOrder: -1 }));
    const localUserVotesBeforeVote = JSON.parse(JSON.stringify(userVotes));

    if (!itemsData[itemId]) { // Safety net, though should be initialized
        itemsData[itemId] = { likes: 0, dislikes: 0, internalScore: 5, element: document.querySelector(`.box[data-item-id="${itemId}"]`), h2Prefix: `${itemId}: `, originalOrder: PREDEFINED_ITEMS_CONFIG.findIndex(i => i.id === itemId)};
    }
    itemsData[itemId].element = localItemBeforeVote.element; // Preserve element reference if item was re-created

    userVotes[itemId] = (previousUserVote === newVoteType) ? null : newVoteType;
    if (previousUserVote === newVoteType) {
        if (newVoteType === 'like' && itemsData[itemId].likes > 0) itemsData[itemId].likes--;
        else if (newVoteType === 'dislike' && itemsData[itemId].dislikes > 0) itemsData[itemId].dislikes--;
    } else {
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
            if (!itemDocSnap.exists()) throw new Error(`Item document ${itemId} does not exist!`);
            let cL = itemDocSnap.data().likes||0; let cD = itemDocSnap.data().dislikes||0;
            let lI=0; let dI=0;
            if(previousUserVote===newVoteType){if(newVoteType==='like')lI=-1;else dI=-1;}
            else{if(previousUserVote==='like')lI=-1;else if(previousUserVote==='dislike')dI=-1; if(newVoteType==='like')lI+=1;else dI+=1;}
            const nL=Math.max(0,cL+lI);const nD=Math.max(0,cD+dI);
            transaction.update(itemRef,{likes:nL,dislikes:nD});
            const uVU={};
            if(userVotes[itemId]===null){uVU[itemId]=deleteField();}else{uVU[itemId]=userVotes[itemId];}
            transaction.set(userVotesRef,uVU,{merge:true});
        });
        console.log(`Vote for ${itemId} (${newVoteType}) recorded in Firestore.`);
    } catch (error) {
        console.error("Vote transaction error for item " + itemId + ": ", error);
        alert("Failed to record vote. Your change has been reverted. Please try again.");
        itemsData[itemId] = localItemBeforeVote; userVotes = localUserVotesBeforeVote;
        updateBoxDisplay(itemId); renderSortedBoxes();
    }
}

function getVoteValue(voteNumber) { if (voteNumber <= 0) return 0; if (voteNumber <= 10) return 0.1; if (voteNumber <= 20) return 0.05; if (voteNumber <= 30) return 0.025; if (voteNumber <= 50) return 0.01; return 0.005; }
function calculateRawVoteScore(count) { let score = 0; for (let i = 1; i <= count; i++) { score += getVoteValue(i); } return score; }
function calculateInternalScore(likes, dislikes) {const rawLikeScore = calculateRawVoteScore(likes); const rawDislikeScore = calculateRawVoteScore(dislikes); return 5 + rawLikeScore - rawDislikeScore;}

function updateBoxDisplay(itemId) {
    const item = itemsData[itemId];
    if (!item || !item.element) { console.warn("updateBoxDisplay: no item/element for", itemId, "\ncurrent itemsData:", JSON.stringify(itemsData[itemId]), "\nall itemsData:", JSON.stringify(itemsData) ); return; }
    const boxElement = item.element; const h2 = boxElement.querySelector('h2');
    const likeBtn = boxElement.querySelector('.like-btn'); const dislikeBtn = boxElement.querySelector('.dislike-btn');
    const likesCountSpan = boxElement.querySelector('.likes-count'); const dislikesCountSpan = boxElement.querySelector('.dislikes-count');

    // Ensure internalScore is up-to-date before displaying
    item.internalScore = calculateInternalScore(item.likes, item.dislikes);
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
    // Detach all existing children before re-appending to ensure order
    // While appending an existing child moves it, clearing first can be safer if elements change
    // while (mainContainer.firstChild) {
    // mainContainer.removeChild(mainContainer.firstChild);
    // }
    itemsArray.forEach(item => { mainContainer.appendChild(item.element); });
}
// --- END LIKING SYSTEM FUNCTIONS ---
