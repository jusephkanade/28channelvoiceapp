// main.js - Entry point for the mobile app
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, signInWithCredential, getRedirectResult, GoogleAuthProvider, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import { getDatabase, ref, get, set } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { CapacitorHttp } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capawesome-team/capacitor-file-opener';
const firebaseConfig = {
    apiKey: "AIzaSyDFkuktrXnsV9-jg2bv5dpJQRR-he8PT3g",
    authDomain: "yairealvarado.firebaseapp.com",
    databaseURL: "https://yaire-591ca-default-rtdb.firebaseio.com",
    projectId: "yaire-591ca",
    storageBucket: "yaire-591ca.firebasestorage.app",
    messagingSenderId: "450381430658",
    appId: "1:450381430658:web:262d1bb7b1732c3990d99b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const provider = new GoogleAuthProvider();

// --- VC HISTORY WRAPPERS ---
window.yaireVcHistoryGet = async () => {
    if (!window.yaireCurrentUser) return [];
    try {
        const snap = await get(ref(db, `users/${window.yaireCurrentUser.uid}/vc_history`));
        return snap.exists() ? snap.val() : [];
    } catch (e) {
        console.error("Error fetching VC history:", e);
        return [];
    }
};

window.closeApp = () => {
    // If running in Capacitor, try to close
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
        window.Capacitor.Plugins.App.exitApp();
    }
};

// 🔹 OTA UPDATER BRIDGE 🔹
window.appUpdateCleanup = async () => {
    try {
        await Filesystem.deleteFile({ path: 'app-update.apk', directory: Directory.Cache });
    } catch (e) {} // ignore if not exists
};

window.appUpdateDownload = async (url, onProgress) => {
    try {
        await window.appUpdateCleanup();
        // CapacitorHttp.downloadFile doesn't support progress events easily in JS,
        // but we can just await it. It might take 10-20 seconds.
        const response = await Filesystem.downloadFile({
            url: url,
            path: 'app-update.apk',
            directory: Directory.Cache
        });
        return response.path;
    } catch (e) {
        console.error("Download error:", e);
        return null;
    }
};

window.appUpdateInstall = async () => {
    try {
        const fileInfo = await Filesystem.getUri({ path: 'app-update.apk', directory: Directory.Cache });
        await FileOpener.openFile({ path: fileInfo.uri, mimeType: 'application/vnd.android.package-archive' });
    } catch (e) {
        console.error("Install error:", e);
    }
};

window.yaireVcHistoryAdd = async (sessionData) => {
    if (!window.yaireCurrentUser) return;
    if (!window.yaireVcHistoryData) window.yaireVcHistoryData = [];
    window.yaireVcHistoryData.unshift(sessionData);
    window.yaireVcHistoryData = window.yaireVcHistoryData.slice(0, 50);

    try {
        const historyRef = ref(db, `users/${window.yaireCurrentUser.uid}/vc_history`);
        await set(historyRef, window.yaireVcHistoryData);
    } catch (e) {
        console.error("Error saving VC history:", e);
    }
};

// Intercept Google Login button clicks (using capture phase)
document.addEventListener('click', (e) => {
  const btn = e.target.closest('#vc-google-login-btn');
  if (btn) {
    e.preventDefault();
    e.stopPropagation();
    
    // Cambiar el texto del botón a "Cargando..."
    btn.innerHTML = '<div class="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin"></div> Abriendo Google...';
    btn.disabled = true;
    
    FirebaseAuthentication.signInWithGoogle().then(result => {
      const credential = GoogleAuthProvider.credential(result.credential.idToken, result.credential.accessToken);
      return signInWithCredential(auth, credential);
    }).then(() => {
      // Login exitoso, el observer onAuthStateChanged se encargará
      btn.innerHTML = 'Conectado';
    }).catch(err => {
      alert("Error al iniciar sesión: " + err.message);
      btn.innerHTML = 'Continuar con Google';
      btn.disabled = false;
    });
  }
}, true);

// Listen for Authentication state
onAuthStateChanged(auth, async (user) => {
  window.yaireCurrentUser = user;
  if (user) {
    window.yaireVcHistoryData = await window.yaireVcHistoryGet();
  } else {
    window.yaireVcHistoryData = [];
  }
  
  // Hide the initial loader now that the app is ready
  const loader = document.getElementById('initial-loader');
  if (loader) {
    loader.style.opacity = '0';
    setTimeout(() => loader.remove(), 500);
  }

  if (window.voiceWidget) {
    window.voiceWidget.updateTranslations();
  }
});

// Process any redirect results
getRedirectResult(auth).catch(err => {
  alert("Error post-login: " + err.message);
});

document.addEventListener('DOMContentLoaded', () => {
  // Add a slight delay to ensure the widget has attached to the DOM
  setTimeout(() => {
    const panel = document.getElementById('vc-panel');
    if (panel) {
      // Force panel to be open and full screen (removing exclamation marks from class names so JS logic works)
      panel.className = 'fixed inset-0 w-full h-full bg-zinc-950 flex flex-col z-50 font-sans overflow-hidden opacity-100 scale-100 pointer-events-auto translate-y-0';
      
      // Hide the toggle bar completely
      const bar = document.getElementById('vc-bar');
      if (bar) {
        bar.style.display = 'none';
      }
      
      // Remove close buttons
      const closeBtn = document.getElementById('vc-close');
      if (closeBtn) closeBtn.style.display = 'none';
      
      // Make sure the state thinks it's open
      if (window.voiceWidget) {
        window.voiceWidget.isOpen = true;
        
        const style = document.createElement('style');
        style.innerHTML = `
          ::-webkit-scrollbar { width: 0px; background: transparent; }
          #vc-panel { border-radius: 0 !important; border: none !important; }
        `;
        document.head.appendChild(style);
      }
    }
  }, 100);
});
