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

// --- Firebase app, auth, db will be initialized ---
let app;
let auth;
let db;

// --- Your web app's Firebase configuration (HARCODED WITH YOUR ACTUAL VALUES) ---
const firebaseConfig = {
  apiKey: "AIzaSyDoo957xiZB2heugMso-C6oS1jSjciLUq0",
  authDomain: "maroltingervote.firebaseapp.com",
  projectId: "maroltingervote",
  storageBucket: "maroltingervote.firebasestorage.app",
  messagingSenderId: "536390639151",
  appId: "1:536390639151:web:3f96ba960920552ecdb0da",
  measurementId: "G-4TRS7E6NGK"
};

// --- Initialize Firebase (directly) ---
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("%cFirebase initialized successfully (HARCODED CONFIG).", "color: orange; font-weight: bold;");
} catch (e) {
    console.error("CRITICAL: Firebase initialization FAILED (HARCODED CONFIG):", e);
    const errorDisplayInit = () => {
        let errorTarget = document.getElementById('auth-container') || document.body;
        const errorMsgElement = document.createElement('p');
        errorMsgElement.style.color = 'red';errorMsgElement.style.fontSize = '18px';errorMsgElement.style.padding = '20px';
        errorMsgElement.textContent = 'Error: Application failed to initialize. Firebase setup error. Check console.';
        if (errorTarget === document.body && errorTarget.firstChild) { errorTarget.insertBefore(errorMsgElement, errorTarget.firstChild); }
        else if (errorTarget) { errorTarget.appendChild(errorMsgElement); }
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', errorDisplayInit);
    else errorDisplayInit();
}

// --- DOM Elements (declared globally, assigned in initializeMainAppLogic) ---
let authContainer, loginView, registerView, showRegisterLink, showLoginLink,
    loginEmailInput, loginPasswordInput, loginButton,
    registerEmailInput, registerPasswordInput, registerButton,
    logoutButton, userInfoDisplay, userEmailSpan, authErrorP,
    mainContentWrapper, authRequiredMessage, verificationMessageP;

// --- Liking System Variables ---
let itemsData = {}; let userVotes = {}; let currentUserId = null; let itemListeners = [];
const PREDEFINED_ITEMS_CONFIG = [
    { id: "POT", initialLikes: 0, initialDislikes: 0 },
    { id: "MAI", initialLikes: 0, initialDislikes: 0 },
    { id: "BAU", initialLikes: 0, initialDislikes: 0 },
];
const ALLOWED_DOMAIN = "maroltingergasse.at";


function initializeMainAppLogic() {
    console.log("%cinitializeMainAppLogic: Called.", "font-weight: bold;");
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
    verificationMessageP = document.getElementById('verification-message');

    if (!loginButton || !authContainer || !mainContentWrapper || !userInfoDisplay || !registerButton || !logoutButton || !verificationMessageP) {
        console.error("CRITICAL: Essential DOM elements missing in initializeMainAppLogic!");
        if(authErrorP) authErrorP.textContent = "Error: Critical UI elements missing.";
        else { const eM = document.createElement('p');eM.style.color='red';eM.textContent='Critical UI elements missing.'; document.body.insertBefore(eM,document.body.firstChild); }
        return;
    }

    onAuthStateChanged(auth, async (user) => {
        console.log("%cON AUTH STATE CHANGED (main logic):", "color: blue; font-weight: bold;", user);
        if(authErrorP) authErrorP.textContent = '';
        if (user) {
            try { await user.reload(); } catch (e) { console.error("Auth reload err:", e); }
            const freshUser = auth.currentUser;
            if (!freshUser) {
                authContainer.style.display = 'block'; loginView.style.display = 'block';
                registerView.style.display = 'none'; userInfoDisplay.style.display = 'none';
                mainContentWrapper.style.display = 'none'; authRequiredMessage.style.display = 'block';
                if(verificationMessageP) verificationMessageP.style.display = 'none';
                return;
            }
            if (freshUser.email && freshUser.email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)) {
                if (freshUser.emailVerified) {
                    console.log("%cAccess GRANTED: " + freshUser.email, "color: green;");
                    authContainer.style.display = 'none'; userInfoDisplay.style.display = 'block';
                    userEmailSpan.textContent = freshUser.email; mainContentWrapper.style.display = 'block';
                    authRequiredMessage.style.display = 'none'; if(verificationMessageP) verificationMessageP.style.display = 'none';
                    initializeLikingSystem();
                } else {
                    console.log("PENDING VERIFICATION: " + freshUser.email);
                    authContainer.style.display = 'none'; userInfoDisplay.style.display = 'block'; userEmailSpan.textContent = `${freshUser.email} (Unverified)`;
                    mainContentWrapper.style.display = 'none'; authRequiredMessage.style.display = 'none';
                    if(verificationMessageP) {
                        verificationMessageP.innerHTML = `Verify <strong>${freshUser.email}</strong>. <button id="resend-verification-btn">Resend</button>`;
                        verificationMessageP.style.display = 'block';
                        const resendBtn = document.getElementById('resend-verification-btn');
                        if(resendBtn) resendBtn.onclick = () => sendEmailVerification(freshUser)
                            .then(() => {
                                verificationMessageP.innerHTML = `Resent to <strong>${freshUser.email}</strong> (Btn in 20s)`;
                                setTimeout(() => { if(verificationMessageP && verificationMessageP.style.display === 'block' && auth.currentUser && !auth.currentUser.emailVerified) verificationMessageP.innerHTML = `Verify <strong>${freshUser.email}</strong>. <button id="resend-verification-btn">Resend</button>`; }, 20000);
                            }).catch(e => { if(authErrorP) authErrorP.textContent="Resend err: "+e.message; });
                    }
                }
            } else {
                console.warn("WRONG DOMAIN: " + freshUser.email);
                if(authErrorP) authErrorP.textContent = `Denied. Use @${ALLOWED_DOMAIN}. You used: ${freshUser.email || 'N/A'}`;
                signOut(auth).catch(e => console.error("Signout err:", e));
                authContainer.style.display = 'block'; loginView.style.display = 'block';
                registerView.style.display = 'none'; userInfoDisplay.style.display = 'none';
                mainContentWrapper.style.display = 'none'; authRequiredMessage.style.display = 'none';
                if(verificationMessageP) verificationMessageP.style.display = 'none';
            }
        } else {
            console.log("SIGNED OUT.");
            authContainer.style.display = 'block'; loginView.style.display = 'block';
            registerView.style.display = 'none'; userInfoDisplay.style.display = 'none';
            mainContentWrapper.style.display = 'none'; authRequiredMessage.style.display = 'block';
            if (verificationMessageP && !verificationMessageP.innerHTML.includes("Registration successful")) {
                verificationMessageP.style.display = 'none';
            }
        }
    });

    if(showRegisterLink) showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); loginView.style.display = 'none'; registerView.style.display = 'block'; if(authErrorP) authErrorP.textContent = ''; if(verificationMessageP) verificationMessageP.style.display = 'none'; });
    if(showLoginLink) showLoginLink.addEventListener('click', (e) => { e.preventDefault(); registerView.style.display = 'none'; loginView.style.display = 'block'; if(authErrorP) authErrorP.textContent = ''; if(verificationMessageP) verificationMessageP.style.display = 'none'; });
    if(registerButton) registerButton.addEventListener('click', () => { const email = registerEmailInput.value; const password = registerPasswordInput.value; if(authErrorP) authErrorP.textContent = ''; if(verificationMessageP) verificationMessageP.style.display = 'none'; if (!email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)) { if(authErrorP) authErrorP.textContent = `Reg. only with @${ALLOWED_DOMAIN}`; return; } if (password.length < 6) { if(authErrorP) authErrorP.textContent = "Password min. 6 chars."; return; } createUserWithEmailAndPassword(auth, email, password).then(uc => sendEmailVerification(uc.user).then(() => signOut(auth))).then(() => { loginView.style.display = 'block'; registerView.style.display = 'none'; if(authErrorP) authErrorP.textContent = ''; if(verificationMessageP) { verificationMessageP.innerHTML = `Registered! Verify <strong>${email}</strong>, then log in.`; verificationMessageP.style.display = 'block';} registerEmailInput.value = ''; registerPasswordInput.value = ''; }).catch(e => { if(authErrorP) authErrorP.textContent = (e.code === 'auth/email-already-in-use') ? "Email registered. Log in." : "Reg. fail: " + e.message; }); });
    if(loginButton) loginButton.addEventListener('click', () => { console.log("%cLOGIN CLICKED", "color:orange;font-weight:bold;"); const e_val = loginEmailInput.value, p_val = loginPasswordInput.value; if(authErrorP)authErrorP.textContent=''; if(verificationMessageP)verificationMessageP.style.display='none'; signInWithEmailAndPassword(auth,e_val,p_val).then(uc=>console.log("%csignIn OK:","color:green;",uc.user.email)).catch(err=>{console.error("%csignIn FAIL:","color:red;",err.code,err.message);if(authErrorP)authErrorP.textContent=(err.code==='auth/user-not-found'||err.code==='auth/wrong-password'||err.code==='auth/invalid-credential')?"Invalid email/pass.":"Login fail: "+err.message;}); });
    if(logoutButton) logoutButton.addEventListener('click', () => { if(authErrorP)authErrorP.textContent='';if(verificationMessageP)verificationMessageP.style.display='none'; signOut(auth).then(()=>{console.log("Signed out.");itemListeners.forEach(unsub=>unsub());itemListeners=[];itemsData={};userVotes={};currentUserId=null;const mc=document.querySelector('.main');if(mc)mc.innerHTML='';}).catch(e=>{if(authErrorP)authErrorP.textContent="Logout err: "+e.message;}); });
    console.log("Main app event listeners initialized.");
}

console.log("script.js: Parsed. Waiting for DOMContentLoaded.");
document.addEventListener('DOMContentLoaded', () => {
    console.log("script.js: DOMContentLoaded event fired.");
    if (!document.getElementById('verification-message')) {
        verificationMessageP = document.createElement('p');
        verificationMessageP.id = 'verification-message';
        verificationMessageP.className = 'info-message';
        verificationMessageP.style.display = 'none';
        const tempAuthContainer = document.getElementById('auth-container');
        if (tempAuthContainer && tempAuthContainer.parentNode) tempAuthContainer.parentNode.insertBefore(verificationMessageP, tempAuthContainer);
        else if (document.body) document.body.appendChild(verificationMessageP);
        else console.error("Cannot insert verificationMessageP!");
    } else {
        verificationMessageP = document.getElementById('verification-message');
    }

    if (app && auth && db) {
        initializeMainAppLogic();
    } else {
        console.error("CRITICAL: Firebase not initialized globally (app, auth, or db is missing). Main app logic cannot start. Check top-level Firebase init.");
    }
});

async function initializeLikingSystem() {
    console.log("%c--- initializeLikingSystem CALLED ---", "color: purple; font-weight: bold;");
    if (auth.currentUser && auth.currentUser.emailVerified) {
        currentUserId = auth.currentUser.uid;
    } else {
        if(mainContentWrapper) mainContentWrapper.style.display = 'none';
        if(authRequiredMessage) authRequiredMessage.style.display = 'block';
        return;
    }
    itemListeners.forEach(unsubscribe => unsubscribe()); itemListeners = [];
    try { await loadUserVotes(); } catch (e) { userVotes = {}; }
    const mainContainer = document.querySelector('.main');
    if (!mainContainer) { console.error("Liking Sys: '.main' container NOT FOUND."); return; }
    mainContainer.innerHTML = ''; itemsData = {};

    for (const pItemConfig of PREDEFINED_ITEMS_CONFIG) {
        const itemId = pItemConfig.id; const h2Prefix = `${itemId}: `;
        const firestoreItemData = await ensureItemDocExists(itemId, pItemConfig);
        if (!firestoreItemData) continue;
        const boxElement = document.createElement('div'); boxElement.className = 'box'; boxElement.dataset.itemId = itemId;
        const h2 = document.createElement('h2');
        const voteControls = document.createElement('div'); voteControls.className = 'vote-controls';
        voteControls.innerHTML = `<button class="like-btn" aria-label="Like">👍<span class="likes-count">(0)</span></button><button class="dislike-btn" aria-label="Dislike">👎<span class="dislikes-count">(0)</span></button>`;
        boxElement.appendChild(h2); boxElement.appendChild(voteControls); mainContainer.appendChild(boxElement);

        itemsData[itemId] = {
            likes: firestoreItemData.likes, dislikes: firestoreItemData.dislikes,
            internalScore: calculateInternalScore(firestoreItemData.likes, firestoreItemData.dislikes),
            h2Prefix: h2Prefix, originalOrder: PREDEFINED_ITEMS_CONFIG.findIndex(i => i.id === itemId),
            element: boxElement // Store the DOM element reference
        };

        const likeBtn = voteControls.querySelector('.like-btn');
        const dislikeBtn = voteControls.querySelector('.dislike-btn');
        if(likeBtn) {
            console.log(`initializeLikingSystem: Adding LIKE listener for item '${itemId}'`);
            likeBtn.addEventListener('click', () => {
                console.log(`LIKE button clicked for item '${itemId}'`);
                handleVote(itemId, 'like');
            });
        } else { console.error(`LIKE button NOT FOUND for item '${itemId}'`); }
        if(dislikeBtn) {
            console.log(`initializeLikingSystem: Adding DISLIKE listener for item '${itemId}'`);
            dislikeBtn.addEventListener('click', () => {
                console.log(`DISLIKE button clicked for item '${itemId}'`);
                handleVote(itemId, 'dislike');
            });
        } else { console.error(`DISLIKE button NOT FOUND for item '${itemId}'`); }

        updateBoxDisplay(itemId);
        const itemRef = doc(db, 'items', itemId);
        const unsubscribe = onSnapshot(itemRef, (docSnap) => {
            if (docSnap.exists()) {
                const d = docSnap.data(); if (itemsData[itemId] && (itemsData[itemId].likes!==d.likes || itemsData[itemId].dislikes!==d.dislikes)) {
                itemsData[itemId].likes=d.likes; itemsData[itemId].dislikes=d.dislikes; updateBoxDisplay(itemId); renderSortedBoxes(); }
            }
        }, e => console.error(`Listen err ${itemId}:`,e));
        itemListeners.push(unsubscribe);
    }
    renderSortedBoxes();
}

async function handleVote(itemId, newVoteType) {
    console.log(`%c--- handleVote CALLED --- Item: ${itemId}, VoteType: ${newVoteType}`, "color: brown; font-weight: bold;");
    if (!auth.currentUser) { console.error("handleVote: No auth.currentUser. Aborting."); alert("Please log in to vote."); return; }
    if (!auth.currentUser.emailVerified) { console.error("handleVote: User email not verified. Aborting."); alert("Please verify your email to vote."); return; }
    if (!currentUserId) { currentUserId = auth.currentUser.uid; if(!currentUserId) { console.error("handleVote: currentUserId still not set. Aborting."); alert("User session error."); return; } console.warn("handleVote: currentUserId was re-set."); }
    console.log(`handleVote: User ${currentUserId} (verified) attempting vote.`);

    const itemRef = doc(db, 'items', itemId); const userVotesRef = doc(db, 'userVotes', currentUserId);
    const previousUserVote = userVotes[itemId];

    const existingBoxElement = itemsData[itemId] ? itemsData[itemId].element : null;
    const itemDataBeforeVoteForRevert = JSON.parse(JSON.stringify(itemsData[itemId] || {likes:0,dislikes:0,internalScore:5,h2Prefix:`${itemId}: `,originalOrder:-1}));
    const userVotesBeforeVoteForRevert = JSON.parse(JSON.stringify(userVotes));

    if (!itemsData[itemId]) {
        itemsData[itemId] = { likes:0,dislikes:0,internalScore:5,h2Prefix:`${itemId}: `,originalOrder:PREDEFINED_ITEMS_CONFIG.findIndex(i=>i.id===itemId), element: existingBoxElement || document.querySelector(`.box[data-item-id="${itemId}"]`) };
    } else if (existingBoxElement) {
        itemsData[itemId].element = existingBoxElement;
    }

    userVotes[itemId]=(previousUserVote===newVoteType)?null:newVoteType;
    if(previousUserVote===newVoteType){if(newVoteType==='like'&&itemsData[itemId].likes>0)itemsData[itemId].likes--;else if(newVoteType==='dislike'&&itemsData[itemId].dislikes>0)itemsData[itemId].dislikes--;}
    else{if(previousUserVote==='like'&&itemsData[itemId].likes>0)itemsData[itemId].likes--;else if(previousUserVote==='dislike'&&itemsData[itemId].dislikes>0)itemsData[itemId].dislikes--; if(newVoteType==='like')itemsData[itemId].likes++;else itemsData[itemId].dislikes++;}
    itemsData[itemId].internalScore=calculateInternalScore(itemsData[itemId].likes,itemsData[itemId].dislikes);
    updateBoxDisplay(itemId);renderSortedBoxes();
    try{await runTransaction(db,async t=>{const iDS=await t.get(itemRef);if(!iDS.exists())throw new Error(`Item ${itemId} missing!`);let cL=iDS.data().likes||0;let cD=iDS.data().dislikes||0;let lI=0,dI=0;if(pUV===newVoteType){if(newVoteType==='like')lI=-1;else dI=-1;}else{if(pUV==='like')lI=-1;else if(pUV==='dislike')dI=-1;if(newVoteType==='like')lI+=1;else dI+=1;}const nL=Math.max(0,cL+lI);const nD=Math.max(0,cD+dI);t.update(iR,{likes:nL,dislikes:nD});const uVU={};if(userVotes[itemId]===null)uVU[itemId]=deleteField();else uVU[itemId]=userVotes[itemId];t.set(uVR,uVU,{merge:true});});console.log(`Vote for ${itemId} (${newVoteType}) recorded.`);}
    catch(e){console.error(`Vote err ${itemId}:`,e);alert("Vote fail.Reverted.");itemsData[itemId]={...itemDataBeforeVoteForRevert, element: existingBoxElement};userVotes=localUserVotesBeforeVote;updateBoxDisplay(itemId);renderSortedBoxes();}}

function getVoteValue(vN){if(vN<=0)return 0;if(vN<=10)return 0.1;if(vN<=20)return 0.05;if(vN<=30)return 0.025;if(vN<=50)return 0.01;return 0.005;}
function calculateRawVoteScore(c){let s=0;for(let i=1;i<=c;i++)s+=getVoteValue(i);return s;}
function calculateInternalScore(l,d){return 5+calculateRawVoteScore(l)-calculateRawVoteScore(d);}
function updateBoxDisplay(itemId){const i=itemsData[itemId];if(!i||!i.element){console.warn("updateBox: no item/element",itemId);return;}const bE=i.element;const h2=bE.querySelector('h2');const lB=bE.querySelector('.like-btn');const dB=bE.querySelector('.dislike-btn');const lCS=bE.querySelector('.likes-count');const dCS=bE.querySelector('.dislikes-count');i.internalScore=calculateInternalScore(i.likes,i.dislikes);const dS=Math.max(0,Math.min(10,i.internalScore));if(h2)h2.textContent=`${i.h2Prefix}${dS.toFixed(1)}/10`;if(lCS)lCS.textContent=`(${i.likes<0?0:i.likes})`;if(dCS)dCS.textContent=`(${i.dislikes<0?0:i.dislikes})`;if(lB)lB.classList.remove('active-like');if(dB)dB.classList.remove('active-dislike');const cUSV=userVotes[itemId];if(cUSV==='like'&&lB)lB.classList.add('active-like');else if(cUSV==='dislike'&&dB)dB.classList.add('active-dislike');}
function renderSortedBoxes(){const mC=document.querySelector('.main');if(!mC)return;const iA=Object.values(itemsData).filter(i=>i&&i.element);iA.sort((a,b)=>{if(b.internalScore!==a.internalScore)return b.internalScore-a.internalScore;return a.originalOrder-b.originalOrder;});iA.forEach(i=>mC.appendChild(i.element));}
// --- END LIKING SYSTEM FUNCTIONS ---
