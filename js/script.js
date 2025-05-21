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
    doc, // collection - not used directly in this snippet, but good to keep if used elsewhere
    getDoc,
    setDoc,
    runTransaction,
    deleteField, // Use deleteField() to remove a field
    onSnapshot
} from "firebase/firestore";

// --- Your web app's Firebase configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyDoo957xiZB2heugMso-C6oS1jSjciLUq0",
  authDomain: "maroltingervote.firebaseapp.com",
  projectId: "maroltingervote",
  storageBucket: "maroltingervote.appspot.com",
  messagingSenderId: "536390639151",
  appId: "1:536390639151:web:3f96ba960920552ecdb0da",
  measurementId: "G-4TRS7E6NGK"
};

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed."); // DEBUG
    const ALLOWED_DOMAIN = "maroltingergasse.at";

    // DOM Elements
    const authContainer = document.getElementById('auth-container');
    const loginView = document.getElementById('login-view');
    const registerView = document.getElementById('register-view');
    const showRegisterLink = document.getElementById('show-register-view');
    const showLoginLink = document.getElementById('show-login-view');
    const loginEmailInput = document.getElementById('login-email');
    const loginPasswordInput = document.getElementById('login-password');
    const loginButton = document.getElementById('login-button'); // CHECK THIS ID IN HTML
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
    } else if (document.body) {
        document.body.insertBefore(verificationMessageP, document.body.firstChild);
    }

    // Ensure critical elements exist
    if (!loginButton) console.error("FATAL: Login button not found!");
    if (!authContainer) console.error("FATAL: Auth container not found!");
    if (!mainContentWrapper) console.error("FATAL: Main content wrapper not found!");


    // --- AUTHENTICATION LOGIC ---
    onAuthStateChanged(auth, async (user) => {
        console.log("%cON AUTH STATE CHANGED:", "color: blue; font-weight: bold;", user); // DEBUG
        authErrorP.textContent = '';

        if (user) {
            console.log("onAuthStateChanged: User object present. Reloading user state..."); // DEBUG
            try {
                await user.reload();
            } catch (reloadError) {
                console.error("onAuthStateChanged: Error reloading user state:", reloadError);
            }
            const freshUser = auth.currentUser;
            console.log("onAuthStateChanged: Fresh user object:", freshUser); // DEBUG

            if (!freshUser) {
                console.log("onAuthStateChanged: User became null after reload. UI set to signed out."); // DEBUG
                authContainer.style.display = 'block'; loginView.style.display = 'block';
                registerView.style.display = 'none'; userInfoDisplay.style.display = 'none';
                mainContentWrapper.style.display = 'none'; authRequiredMessage.style.display = 'block';
                verificationMessageP.style.display = 'none';
                return;
            }

            if (freshUser.email && freshUser.email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)) {
                if (freshUser.emailVerified) {
                    console.log("%conAuthStateChanged: Access GRANTED for: " + freshUser.email, "color: green; font-weight: bold;"); // DEBUG
                    authContainer.style.display = 'none';
                    userInfoDisplay.style.display = 'block';
                    userEmailSpan.textContent = freshUser.email;
                    mainContentWrapper.style.display = 'block'; // <<<< SHOW MAIN CONTENT
                    authRequiredMessage.style.display = 'none';
                    verificationMessageP.style.display = 'none';
                    initializeLikingSystem(); // <<<< INITIALIZE LIKING SYSTEM
                } else {
                    console.log("onAuthStateChanged: Access PENDING VERIFICATION for:", freshUser.email); // DEBUG
                    authContainer.style.display = 'none'; userInfoDisplay.style.display = 'block';
                    userEmailSpan.textContent = `${freshUser.email} (Unverified)`;
                    mainContentWrapper.style.display = 'none'; authRequiredMessage.style.display = 'none';
                    verificationMessageP.innerHTML = `A verification email was sent to <strong>${freshUser.email}</strong>. Please verify your email to access content. <button id="resend-verification-btn">Resend Email</button>`;
                    verificationMessageP.style.display = 'block';
                    const resendBtn = document.getElementById('resend-verification-btn');
                    if (resendBtn) {
                        resendBtn.onclick = () => {
                            sendEmailVerification(freshUser)
                                .then(() => { /* ... resend success UI ... */ })
                                .catch(error => { authErrorP.textContent = "Error resending: " + error.message; });
                        };
                    }
                }
            } else {
                console.warn("onAuthStateChanged: Access DENIED (wrong domain):", freshUser.email); // DEBUG
                authErrorP.textContent = `Access denied. Email must end with @${ALLOWED_DOMAIN}. You provided: ${freshUser.email || 'N/A'}`;
                authContainer.style.display = 'block'; loginView.style.display = 'block';
                registerView.style.display = 'none'; userInfoDisplay.style.display = 'none';
                mainContentWrapper.style.display = 'none'; authRequiredMessage.style.display = 'none';
                verificationMessageP.style.display = 'none';
                signOut(auth).catch(err => console.error("Error signing out after domain denial:", err));
            }
        } else {
            console.log("onAuthStateChanged: User is SIGNED OUT. UI set to signed out."); // DEBUG
            authContainer.style.display = 'block'; loginView.style.display = 'block';
            registerView.style.display = 'none'; userInfoDisplay.style.display = 'none';
            mainContentWrapper.style.display = 'none'; authRequiredMessage.style.display = 'block';
            if (verificationMessageP && !verificationMessageP.innerHTML.includes("Registration successful")) { // Check if verificationMessageP exists
                verificationMessageP.style.display = 'none';
            }
        }
    });

    showRegisterLink.addEventListener('click', (e) => { /* ... same ... */ });
    showLoginLink.addEventListener('click', (e) => { /* ... same ... */ });
    registerButton.addEventListener('click', () => { /* ... same correct registration logic ... */ });

    // --- Login Button Listener (with detailed logs) ---
    if (loginButton) { // Add a check to ensure the button exists before adding listener
        loginButton.addEventListener('click', () => {
            console.log("%cLOGIN BUTTON CLICKED", "color: orange; font-weight: bold;"); // DEBUG
            const email = loginEmailInput.value;
            const password = loginPasswordInput.value;
            console.log("Login attempt with Email:", email, "Password:", password ? "******" : "(empty)"); // DEBUG

            authErrorP.textContent = '';
            if (verificationMessageP) verificationMessageP.style.display = 'none';

            signInWithEmailAndPassword(auth, email, password)
                .then((userCredential) => {
                    console.log("%csignInWithEmailAndPassword SUCCESS:", "color: green;", userCredential.user.email); // DEBUG
                    // NOTE: onAuthStateChanged will now take over.
                    // It will reload the user, check verification/domain, and update UI.
                    // No direct UI changes needed here if onAuthStateChanged is robust.
                })
                .catch((error) => {
                    console.error("%csignInWithEmailAndPassword FAILED:", "color: red;", error.code, error.message); // DEBUG
                    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                        authErrorP.textContent = "Invalid email or password.";
                    } else if (error.code === 'auth/invalid-email') {
                        authErrorP.textContent = "The email address is not valid.";
                    } else {
                        authErrorP.textContent = "Login failed: " + error.message;
                    }
                });
        });
    } else {
        console.error("Could not find login button to attach event listener."); // DEBUG
    }


    logoutButton.addEventListener('click', () => { /* ... same correct logout logic ... */ });

    // --- LIKING/RANKING SYSTEM with FIRESTORE ---
    // ... (All your liking system code: itemsData, userVotes, keys, initializeLikingSystem, etc.)
    // Ensure this entire section is present and correct from your working Firestore version.
    // For brevity, I'm omitting the full copy-paste here, but it's crucial.
    let itemsData = {}; let userVotes = {}; let currentUserId = null; let itemListeners = [];
    const PREDEFINED_ITEMS_CONFIG = [
        { id: "POT", initialLikes: 0, initialDislikes: 0 },
        { id: "MAI", initialLikes: 0, initialDislikes: 0 },
        { id: "BAU", initialLikes: 0, initialDislikes: 0 },
    ];

    async function initializeLikingSystem() {
        console.log("--- initializeLikingSystem CALLED ---"); // DEBUG
        // ... (rest of your initializeLikingSystem) ...
         if (auth.currentUser && auth.currentUser.emailVerified) {
            currentUserId = auth.currentUser.uid;
        } else {
            console.error("initializeLikingSystem: Pre-condition not met (user not logged in or verified)."); // DEBUG
            mainContentWrapper.style.display = 'none';
            authRequiredMessage.style.display = auth.currentUser && !auth.currentUser.emailVerified ? 'none' : 'block';
            return;
        }

        itemListeners.forEach(unsubscribe => unsubscribe()); itemListeners = [];
        try { await loadUserVotes(); } catch (e) { console.error("Error during loadUserVotes in init:", e); userVotes = {}; }

        const mainContainer = document.querySelector('.main');
        if (!mainContainer) { console.error("'.main' container not found in init."); return; }
        mainContainer.innerHTML = ''; itemsData = {};

        for (const pItemConfig of PREDEFINED_ITEMS_CONFIG) {
            // ... (loop as before)
             const itemId = pItemConfig.id; const h2Prefix = `${itemId}: `;
            const firestoreItemData = await ensureItemDocExists(itemId, pItemConfig);
            if (!firestoreItemData) { console.warn(`Skipping item ${itemId} in init.`); continue; }

            const boxElement = document.createElement('div'); boxElement.className = 'box'; boxElement.dataset.itemId = itemId;
            const h2 = document.createElement('h2');
            const voteControls = document.createElement('div'); voteControls.className = 'vote-controls';
            voteControls.innerHTML = `<button class="like-btn" aria-label="Like">👍<span class="likes-count">(0)</span></button><button class="dislike-btn" aria-label="Dislike">👎<span class="dislikes-count">(0)</span></button>`;
            boxElement.appendChild(h2); boxElement.appendChild(voteControls); mainContainer.appendChild(boxElement);

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
    // ... (ALL other helper functions: loadUserVotes, ensureItemDocExists, handleVote, updateBoxDisplay, etc.)
    // Ensure they are defined as in your previous working Firestore version.
    function calculateInternalScore(likes, dislikes) {const rawLikeScore = calculateRawVoteScore(likes); const rawDislikeScore = calculateRawVoteScore(dislikes); return 5 + rawLikeScore - rawDislikeScore;}
    async function loadUserVotes() {if (!currentUserId) { userVotes = {}; return; } const userVotesRef = doc(db, 'userVotes', currentUserId); try { const docSnap = await getDoc(userVotesRef); userVotes = (docSnap.exists() ? docSnap.data() : {}) || {}; } catch (error) { console.error("Error loading user votes:", error); userVotes = {}; }}
    async function ensureItemDocExists(itemId, initialData) { const itemRef = doc(db, 'items', itemId); const docSnap = await getDoc(itemRef); if (!docSnap.exists()) { try { const dataToSet = { likes: initialData.initialLikes || 0, dislikes: initialData.initialDislikes || 0 }; await setDoc(itemRef, dataToSet); console.log(`Created item doc for ${itemId}`); return dataToSet; } catch (error) { console.error(`Error creating item doc for ${itemId}:`, error); return null; } } return docSnap.data(); }
    function getVoteValue(voteNumber) { if (voteNumber <= 0) return 0; if (voteNumber <= 10) return 0.1; if (voteNumber <= 20) return 0.05; if (voteNumber <= 30) return 0.025; if (voteNumber <= 50) return 0.01; return 0.005; }
    function calculateRawVoteScore(count) { let score = 0; for (let i = 1; i <= count; i++) { score += getVoteValue(i); } return score; }
    function updateBoxDisplay(itemId) { const item = itemsData[itemId]; if (!item || !item.element) return; const boxElement = item.element; const h2 = boxElement.querySelector('h2'); const likeBtn = boxElement.querySelector('.like-btn'); const dislikeBtn = boxElement.querySelector('.dislike-btn'); const likesCountSpan = boxElement.querySelector('.likes-count'); const dislikesCountSpan = boxElement.querySelector('.dislikes-count'); const displayScore = Math.max(0, Math.min(10, item.internalScore)); if (h2) h2.textContent = `${item.h2Prefix}${displayScore.toFixed(1)}/10`; if (likesCountSpan) likesCountSpan.textContent = `(${item.likes < 0 ? 0 : item.likes})`; if (dislikesCountSpan) dislikesCountSpan.textContent = `(${item.dislikes < 0 ? 0 : item.dislikes})`; if (likeBtn) likeBtn.classList.remove('active-like'); if (dislikeBtn) dislikeBtn.classList.remove('active-dislike'); const currentUserSpecificVote = userVotes[itemId]; if (currentUserSpecificVote === 'like' && likeBtn) { likeBtn.classList.add('active-like'); } else if (currentUserSpecificVote === 'dislike' && dislikeBtn) { dislikeBtn.classList.add('active-dislike'); } }
    function renderSortedBoxes() { const mainContainer = document.querySelector('.main'); if (!mainContainer) return; const itemsArray = Object.values(itemsData).filter(item => item && item.element); itemsArray.sort((a, b) => { if (b.internalScore !== a.internalScore) { return b.internalScore - a.internalScore; } return a.originalOrder - b.originalOrder; }); itemsArray.forEach(item => { mainContainer.appendChild(item.element); }); }
    async function handleVote(itemId, newVoteType) { if (!currentUserId || !auth.currentUser || !auth.currentUser.emailVerified) { alert("Log in & verify email to vote."); return; } const itemRef = doc(db, 'items', itemId); const userVotesRef = doc(db, 'userVotes', currentUserId); const previousUserVote = userVotes[itemId]; const localItemBeforeVote = { ...itemsData[itemId] }; const localUserVotesBeforeVote = { ...userVotes }; userVotes[itemId] = (previousUserVote === newVoteType) ? null : newVoteType; if (previousUserVote === newVoteType) { if (newVoteType === 'like') itemsData[itemId].likes--; else itemsData[itemId].dislikes--; } else { if (previousUserVote === 'like') itemsData[itemId].likes--; else if (previousUserVote === 'dislike') itemsData[itemId].dislikes--; if (newVoteType === 'like') itemsData[itemId].likes++; else itemsData[itemId].dislikes++; } itemsData[itemId].internalScore = calculateInternalScore(itemsData[itemId].likes, itemsData[itemId].dislikes); updateBoxDisplay(itemId); renderSortedBoxes(); try { await runTransaction(db, async (transaction) => { const itemDocSnap = await transaction.get(itemRef); if (!itemDocSnap.exists()) throw "Item document does not exist!"; let cL = itemDocSnap.data().likes||0; let cD = itemDocSnap.data().dislikes||0; let lI=0; let dI=0; if(previousUserVote===newVoteType){if(newVoteType==='like')lI=-1;else dI=-1;}else{if(previousUserVote==='like')lI=-1;else if(previousUserVote==='dislike')dI=-1;if(newVoteType==='like')lI+=1;else dI+=1;} const nL=Math.max(0,cL+lI);const nD=Math.max(0,cD+dI); transaction.update(itemRef,{likes:nL,dislikes:nD}); const uVU={}; if(userVotes[itemId]===null){uVU[itemId]=deleteField();}else{uVU[itemId]=userVotes[itemId];} transaction.set(userVotesRef,uVU,{merge:true}); }); console.log(`Vote for ${itemId} (${newVoteType}) recorded.`); } catch (error) { console.error("Vote transaction error: ", error); alert("Failed to record vote."); itemsData[itemId]=localItemBeforeVote;userVotes=localUserVotesBeforeVote;updateBoxDisplay(itemId);renderSortedBoxes();}}

}); // End of DOMContentLoaded
