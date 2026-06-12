// main.js - Entry point for the mobile app
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, signInWithPopup, getRedirectResult, GoogleAuthProvider, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';

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
const provider = new GoogleAuthProvider();

// Intercept Google Login button clicks (using capture phase)
document.addEventListener('click', (e) => {
  const btn = e.target.closest('#vc-google-login-btn');
  if (btn) {
    e.preventDefault();
    e.stopPropagation();
    
    // Cambiar el texto del botón a "Cargando..."
    btn.innerHTML = '<div class="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin"></div> Abriendo Google...';
    btn.disabled = true;
    
    signInWithPopup(auth, provider).then(() => {
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
onAuthStateChanged(auth, (user) => {
  window.yaireCurrentUser = user;
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
      // Force panel to be open and full screen
      panel.className = 'fixed inset-0 w-full h-full bg-zinc-950 flex flex-col z-50 font-sans overflow-hidden !opacity-100 !scale-100 !pointer-events-auto !translate-y-0';
      
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
