// main.js - Entry point for the mobile app
// We rely on the voice-channel-widget.js which exposes the class globally

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
      
      // Remove close buttons or ver mas from the template since it's full screen
      const closeBtn = document.getElementById('vc-close');
      if (closeBtn) closeBtn.style.display = 'none';
      
      // Make sure the state thinks it's open so it renders properly
      if (window.voiceWidget) {
        window.voiceWidget.isOpen = true;
        
        // Hide scrollbars but allow scrolling in chat
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
