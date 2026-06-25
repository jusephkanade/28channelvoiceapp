// main.js - 28E Oracle Mobile App Entry Point
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, signInWithCredential, GoogleAuthProvider, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import { getDatabase, ref, get, set, query, limitToLast } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { ForegroundService } from '@capawesome-team/capacitor-android-foreground-service';

if (!window.Capacitor) window.Capacitor = { Plugins: {} };
if (!window.Capacitor.Plugins) window.Capacitor.Plugins = {};
window.Capacitor.Plugins.ForegroundService = ForegroundService;

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

// ═══ SOUND MANAGER ═══
class OracleAudio {
  static sounds = {
    hover: 'SND01_sine/tap_01.wav',
    click: 'SND01_sine/select.wav',
    connect: 'siriSounds18Separate/jbl_success_sae.wav',
    latency: 'siriSounds18Separate/jbl_latency_sae_v2.wav',
    join: 'sounds/activity_user_join.mp3',
    left: 'sounds/activity_user_left.mp3',
    toggleOn: 'SND01_sine/toggle_on.wav',
    toggleOff: 'SND01_sine/toggle_off.wav',
    messageReceived: 'sounds/nuevomensajeenelchatdevoz.wav',
    messageSent: 'SND01_sine/transition_up.wav',
    transitionDown: 'siriSounds18Separate/siri-begin-improved.wav',
    reaction: 'SND01_sine/tap_03.wav'
  };

  static typeSounds = [
    'SND01_sine/type_01.wav', 'SND01_sine/type_02.wav',
    'SND01_sine/type_03.wav', 'SND01_sine/type_04.wav',
    'SND01_sine/type_05.wav'
  ];

  static playTyping() {
    const rnd = this.typeSounds[Math.floor(Math.random() * this.typeSounds.length)];
    const audio = new Audio(rnd);
    audio.volume = 0.3;
    audio.play().catch(() => {});
  }

  static play(soundName, loop = false) {
    if (!this.sounds[soundName]) return;
    const audio = new Audio(this.sounds[soundName]);
    audio.loop = loop;
    audio.play().catch(() => {});
    return audio;
  }
}

// ═══ ORACLE ROOM MANAGER ═══
class OracleRoom {
  constructor() {
    this.socket = null;
    this.stream = null;
    this.peers = new Map();
    this.pendingIce = new Map();

    this.myId = null;
    this.users = [];
    this.cameraEnabled = false;
    this.micEnabled = true;

    this.ytPlayer = null;
    this.isYtReady = false;
    this.musicQueue = [];
    this.musicState = { currentIndex: -1, isPlaying: false };

    this.audioContexts = new Map();
    this.speakingStates = new Map();
    this.localSpeakingDetector = null;
    this.unreadChatCount = 0;

    this.iceConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        {
          urls: 'turn:global.relay.metered.ca:80',
          username: '5187d4c4c5314e021d568c2d',
          credential: 'Bb9ysI8BgTjn/dET'
        }
      ]
    };

    this.initUI();
  }

  async init() {
    const user = window.yaireCurrentUser;
    if (!user) return alert("Debes iniciar sesión con Google.");

    const passPromise = fetch('https://yaire-591ca-default-rtdb.firebaseio.com/config/voicePassword.json')
      .then(res => res.json())
      .catch(() => 'nopass');

    // Switch Screens
    const lobby = document.getElementById('lobby-screen');
    const room = document.getElementById('room-screen');
    if (lobby) lobby.classList.add('hidden');
    if (room) {
      room.classList.remove('hidden');
      if (window.gsap) gsap.from(room, { opacity: 0, scale: 0.96, duration: 0.5, ease: "power2.out" });
    }

    // Start Foreground Service
    try {
      if (window.Capacitor?.Plugins?.ForegroundService) {
        await ForegroundService.startForegroundService({
          notificationTitle: '28E Oracle Active',
          notificationBody: 'Sala inmersiva P2P en segundo plano',
          notificationId: 1001
        });
      }
    } catch (e) {
      console.warn("Foreground service error:", e);
    }

    this.connectSocket(user.displayName, passPromise, user.photoURL, window.yaireUserHandle);
    this.acquireMedia();
  }

  initUI() {
    // Dock Controls
    document.getElementById('btn-mic')?.addEventListener('click', () => this.toggleMic());
    document.getElementById('btn-cam')?.addEventListener('click', () => this.toggleCam());
    document.getElementById('btn-leave')?.addEventListener('click', () => this.leaveRoom());

    // Drawers Toggles
    const backdrop = document.getElementById('drawer-backdrop');
    const chatDrawer = document.getElementById('chat-drawer');
    const peopleDrawer = document.getElementById('people-drawer');

    document.getElementById('btn-chat-toggle')?.addEventListener('click', () => {
      this.unreadChatCount = 0;
      document.getElementById('chat-unread-badge')?.classList.add('hidden');
      backdrop?.classList.add('open');
      chatDrawer?.classList.add('open');
    });

    document.getElementById('btn-people-toggle')?.addEventListener('click', () => {
      backdrop?.classList.add('open');
      peopleDrawer?.classList.add('open');
    });

    const closeDrawers = () => {
      backdrop?.classList.remove('open');
      chatDrawer?.classList.remove('open');
      peopleDrawer?.classList.remove('open');
    };

    backdrop?.addEventListener('click', closeDrawers);
    document.getElementById('btn-close-chat')?.addEventListener('click', closeDrawers);
    document.getElementById('btn-close-people')?.addEventListener('click', closeDrawers);

    // Chat Form
    document.getElementById('chat-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.sendChat();
    });

    document.getElementById('chat-input')?.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') OracleAudio.playTyping();
    });

    // Reactions
    document.querySelectorAll('.btn-react').forEach(btn => {
      btn.addEventListener('click', () => {
        const emoji = btn.textContent;
        OracleAudio.play('reaction');
        this.showReaction(emoji, 'local');
        if (this.socket) this.socket.emit('reaction', { emoji });
      });
    });

    // YouTube Toggle
    document.getElementById('yt-btn-toggle')?.addEventListener('click', () => {
      const cont = document.getElementById('yt-container');
      cont?.classList.toggle('hidden');
    });
  }

  async acquireMedia() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false // Cámara apagada por defecto
      });
      this.updateLocalVideoElement();
      this.setupLocalSpeakingDetection(this.stream);
    } catch (err) {
      alert("Error al obtener acceso a micrófono: " + err.message);
    }
  }

  updateLocalVideoElement() {
    const user = window.yaireCurrentUser;
    this.updateVideoElement('local', this.stream, {
      displayName: user?.displayName || 'Tú',
      photoURL: user?.photoURL,
      oracleHandle: window.yaireUserHandle
    });
  }

  setupLocalSpeakingDetection(stream) {
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      let wasSpeaking = false;

      setInterval(() => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b) / data.length;
        const isSpeaking = avg > 15 && this.micEnabled;

        if (isSpeaking !== wasSpeaking) {
          wasSpeaking = isSpeaking;
          this.setSpeakingState('local', isSpeaking);
          if (this.socket) this.socket.emit('speaking_state', { speaking: isSpeaking });
        }
      }, 100);
    } catch (e) {}
  }

  setupRemoteSpeakingDetection(peerId, stream) {
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      let wasSpeaking = false;

      const interval = setInterval(() => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b) / data.length;
        const isSpeaking = avg > 12;

        if (isSpeaking !== wasSpeaking) {
          wasSpeaking = isSpeaking;
          this.setSpeakingState(peerId, isSpeaking);
        }
      }, 100);

      this.audioContexts.set(peerId, { ctx, interval });
    } catch (e) {}
  }

  setSpeakingState(id, isSpeaking) {
    this.speakingStates.set(id, isSpeaking);
    const container = document.getElementById(`video-container-${id}`);
    container?.classList.toggle('speaking', isSpeaking);
    const bars = document.getElementById(`speak-bars-${id}`);
    bars?.classList.toggle('active', isSpeaking);
    this.updatePeopleList();
  }

  updateVideoElement(id, stream, userObj) {
    const grid = document.getElementById('video-grid');
    let container = document.getElementById(`video-container-${id}`);

    if (!container && grid) {
      container = document.createElement('div');
      container.id = `video-container-${id}`;
      container.className = 'video-container';
      const avatarUrl = userObj?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(userObj?.displayName || 'U')}&background=random`;
      const displayName = userObj?.displayName || 'Usuario';
      const handle = userObj?.oracleHandle ? `@${userObj.oracleHandle}` : '';
      const isLocal = id === 'local';

      container.innerHTML = `
        <video id="vid-${id}" autoplay playsinline ${isLocal ? 'muted' : ''} style="${isLocal ? 'transform:scaleX(-1);' : ''}"></video>
        <div class="avatar-fallback">
          <div class="w-20 h-20 rounded-full glass-light flex items-center justify-center overflow-hidden shadow-2xl">
            <img src="${avatarUrl}" class="w-full h-full object-cover" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random'" />
          </div>
        </div>
        <div class="video-overlay-info">
          <div class="flex items-center gap-2">
            <div id="speak-bars-${id}" class="speak-bars">
              <div class="bar" style="height:3px;"></div>
              <div class="bar" style="height:6px;"></div>
              <div class="bar" style="height:4px;"></div>
              <div class="bar" style="height:8px;"></div>
            </div>
            <span class="text-xs font-bold text-white/90 drop-shadow">${displayName}${isLocal ? ' (Tú)' : ''}</span>
            ${handle ? `<span class="text-[10px] text-amber-500 font-extrabold">${handle}</span>` : ''}
          </div>
        </div>
        <div id="reactions-${id}" class="absolute inset-0 pointer-events-none overflow-hidden rounded-[1.25rem] z-10"></div>
      `;
      grid.appendChild(container);
      this.updateGridLayout();

      if (window.gsap) gsap.from(container, { scale: 0.85, opacity: 0, duration: 0.4, ease: "back.out(1.4)" });
    }

    const vid = container?.querySelector('video');
    if (vid && stream) {
      vid.srcObject = stream;
      if (stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled) {
        container.classList.add('has-video');
      } else {
        container.classList.remove('has-video');
      }
    }
  }

  removeVideoElement(id) {
    const container = document.getElementById(`video-container-${id}`);
    if (container) {
      if (window.gsap) {
        gsap.to(container, { scale: 0.8, opacity: 0, duration: 0.3, onComplete: () => { container.remove(); this.updateGridLayout(); } });
      } else {
        container.remove();
        this.updateGridLayout();
      }
    }
    if (this.audioContexts.has(id)) {
      const ac = this.audioContexts.get(id);
      clearInterval(ac.interval);
      ac.ctx.close();
      this.audioContexts.delete(id);
    }
    this.speakingStates.delete(id);
  }

  updateGridLayout() {
    const grid = document.getElementById('video-grid');
    if (!grid) return;
    const count = grid.children.length;
    grid.className = 'video-grid';
    if (count === 1) grid.classList.add('grid-1');
    else if (count === 2) grid.classList.add('grid-2');
    else if (count === 3 || count === 4) grid.classList.add(count === 3 ? 'grid-3' : 'grid-4');
    else grid.classList.add('grid-many');
  }

  connectSocket(name, passPromise, photoURL, oracleHandle) {
    this.socket = io('https://28e-production.up.railway.app', { transports: ['websocket'] });

    this.socket.on('connect', async () => {
      const pass = await Promise.resolve(passPromise);
      this.socket.emit('join_channel', { password: pass, displayName: name, photoURL, oracleHandle });
    });

    this.socket.on('joined', ({ userId, existingUsers }) => {
      this.myId = userId;
      this.users = existingUsers;
      existingUsers.forEach(u => this.createOffer(u.id));
      OracleAudio.play('connect');
      this.updateUserCount();
      this.updatePeopleList();
    });

    this.socket.on('user_joined', ({ userId, displayName, photoURL, oracleHandle }) => {
      this.users.push({ id: userId, displayName, photoURL, oracleHandle });
      this.updateVideoElement(userId, null, { displayName, photoURL, oracleHandle });
      OracleAudio.play('join');
      this.updateUserCount();
      this.updatePeopleList();
    });

    this.socket.on('user_left', ({ userId }) => {
      OracleAudio.play('left');
      this.closePeer(userId);
      this.removeVideoElement(userId);
      this.users = this.users.filter(x => x.id !== userId);
      this.updateUserCount();
      this.updatePeopleList();
    });

    // WebRTC
    this.socket.on('webrtc_offer', async ({ from, sdp }) => this.handleOffer(from, sdp));
    this.socket.on('webrtc_answer', async ({ from, sdp }) => {
      const pc = this.peers.get(from);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        this.flushIce(from);
      }
    });
    this.socket.on('ice_candidate', async ({ from, candidate }) => {
      const pc = this.peers.get(from);
      if (pc?.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      } else {
        if (!this.pendingIce.has(from)) this.pendingIce.set(from, []);
        this.pendingIce.get(from).push(candidate);
      }
    });

    this.socket.on('speaking_state', ({ from, speaking }) => this.setSpeakingState(from, speaking));
    this.socket.on('reaction', ({ from, emoji }) => {
      OracleAudio.play('reaction');
      this.showReaction(emoji, from);
    });

    this.socket.on('chat_message', ({ from, name, text, ts }) => {
      if (from !== this.myId) {
        this.appendChatMsg(from, name, text, ts);
        OracleAudio.play('messageReceived');
        const drawer = document.getElementById('chat-drawer');
        if (!drawer?.classList.contains('open')) {
          this.unreadChatCount++;
          const badge = document.getElementById('chat-unread-badge');
          if (badge) {
            badge.textContent = this.unreadChatCount > 9 ? '9+' : this.unreadChatCount;
            badge.classList.remove('hidden');
          }
        }
      }
    });

    // YouTube Sync
    this.socket.on('music_sync', ({ queue, state, currentTrack, currentTime }) => {
      this.musicQueue = queue || [];
      this.musicState = state || { isPlaying: false };
      const dockTitle = document.getElementById('music-dock-title');
      if (currentTrack) {
        if (dockTitle) dockTitle.textContent = currentTrack.title || 'Canción en Oracle';
        document.getElementById('yt-container')?.classList.remove('hidden');
        this.initOrUpdateYoutube(currentTrack.id, currentTime || 0, state.isPlaying);
      } else {
        if (dockTitle) dockTitle.textContent = 'Sin música';
      }
    });
  }

  makePeer(peerId) {
    if (this.peers.has(peerId)) this.closePeer(peerId);
    const pc = new RTCPeerConnection(this.iceConfig);
    if (this.stream) {
      this.stream.getTracks().forEach(t => pc.addTrack(t, this.stream));
    }
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) this.socket.emit('ice_candidate', { to: peerId, candidate });
    };
    pc.ontrack = (event) => {
      const stream = event.streams[0] || new MediaStream([event.track]);
      const userObj = this.users.find(u => u.id === peerId);
      this.updateVideoElement(peerId, stream, userObj);
      this.setupRemoteSpeakingDetection(peerId, stream);
    };
    this.peers.set(peerId, pc);
    return pc;
  }

  async createOffer(peerId) {
    const pc = this.makePeer(peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.socket.emit('webrtc_offer', { to: peerId, sdp: pc.localDescription });
  }

  async handleOffer(fromId, sdp) {
    const pc = this.makePeer(fromId);
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.socket.emit('webrtc_answer', { to: fromId, sdp: pc.localDescription });
    this.flushIce(fromId);
  }

  flushIce(peerId) {
    const pc = this.peers.get(peerId);
    const queue = this.pendingIce.get(peerId) || [];
    queue.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}));
    this.pendingIce.delete(peerId);
  }

  closePeer(peerId) {
    const pc = this.peers.get(peerId);
    if (pc) { pc.close(); this.peers.delete(peerId); }
  }

  toggleMic() {
    this.micEnabled = !this.micEnabled;
    OracleAudio.play(this.micEnabled ? 'toggleOn' : 'toggleOff');
    if (this.stream) this.stream.getAudioTracks().forEach(t => t.enabled = this.micEnabled);
    const iconOn = document.getElementById('icon-mic-on');
    const iconOff = document.getElementById('icon-mic-off');
    iconOn?.classList.toggle('hidden', !this.micEnabled);
    iconOff?.classList.toggle('hidden', this.micEnabled);
    if (this.socket) this.socket.emit('user_mute_state', { muted: !this.micEnabled });
  }

  async toggleCam() {
    this.cameraEnabled = !this.cameraEnabled;
    OracleAudio.play(this.cameraEnabled ? 'toggleOn' : 'toggleOff');
    const iconOn = document.getElementById('icon-cam-on');
    const iconOff = document.getElementById('icon-cam-off');
    const btnCam = document.getElementById('btn-cam');

    iconOn?.classList.toggle('hidden', !this.cameraEnabled);
    iconOff?.classList.toggle('hidden', this.cameraEnabled);
    btnCam?.classList.toggle('muted', !this.cameraEnabled);

    if (this.cameraEnabled) {
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        const videoTrack = camStream.getVideoTracks()[0];
        if (this.stream) this.stream.addTrack(videoTrack);
        this.peers.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(videoTrack);
          else pc.addTrack(videoTrack, this.stream);
        });
        this.updateLocalVideoElement();
      } catch (e) {
        alert("No se pudo iniciar la cámara: " + e.message);
        this.cameraEnabled = false;
      }
    } else {
      if (this.stream) {
        this.stream.getVideoTracks().forEach(t => { t.stop(); this.stream.removeTrack(t); });
      }
      const localCont = document.getElementById('video-container-local');
      localCont?.classList.remove('has-video');
    }
  }

  updateUserCount() {
    const total = this.users.length + 1;
    const badge = document.getElementById('user-count-badge');
    if (badge) badge.textContent = total;
  }

  updatePeopleList() {
    const list = document.getElementById('people-list');
    if (!list) return;
    const me = window.yaireCurrentUser;
    const all = [
      { id: 'local', displayName: me?.displayName || 'Tú', photoURL: me?.photoURL, oracleHandle: window.yaireUserHandle, isSpeaking: this.speakingStates.get('local'), isMe: true },
      ...this.users.map(u => ({ ...u, isSpeaking: this.speakingStates.get(u.id) }))
    ];

    list.innerHTML = all.map(u => {
      const avatar = u.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName)}&background=random`;
      return `
        <div class="flex items-center justify-between p-3 rounded-2xl glass-light">
          <div class="flex items-center gap-3 min-w-0">
            <div class="relative shrink-0">
              <img src="${avatar}" class="w-10 h-10 rounded-full object-cover border ${u.isSpeaking ? 'border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.5)]' : 'border-white/10'}" />
              ${u.isSpeaking ? '<div class="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-amber-400 rounded-full border-2 border-black animate-ping"></div>' : ''}
            </div>
            <div class="min-w-0">
              <p class="text-sm font-extrabold text-white truncate">${u.displayName}${u.isMe ? ' (Tú)' : ''}</p>
              ${u.oracleHandle ? `<p class="text-[11px] text-amber-400 font-bold">@${u.oracleHandle}</p>` : ''}
            </div>
          </div>
          <span class="text-xs px-2.5 py-1 rounded-full ${u.isSpeaking ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-zinc-500'}">${u.isSpeaking ? 'Transmitiendo' : 'Conectado'}</span>
        </div>
      `;
    }).join('');
  }

  sendChat() {
    const input = document.getElementById('chat-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    OracleAudio.play('messageSent');
    if (this.socket) this.socket.emit('chat_message', { text });
    this.appendChatMsg('local', window.yaireCurrentUser?.displayName || 'Tú', text, Date.now());
    input.value = '';
  }

  appendChatMsg(from, name, text, ts) {
    const cont = document.getElementById('chat-messages');
    if (!cont) return;
    const isMe = from === 'local' || from === this.myId;
    const time = new Date(ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    
    const div = document.createElement('div');
    div.className = `flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-3`;
    div.innerHTML = `
      <div class="flex items-center gap-2 mb-1 px-1">
        <span class="text-[10px] font-black uppercase tracking-wider ${isMe ? 'text-amber-400' : 'text-zinc-400'}">${name}</span>
        <span class="text-[9px] text-zinc-600 font-mono">${time}</span>
      </div>
      <div class="max-w-[85%] px-4 py-2.5 rounded-2xl text-sm font-medium shadow-md ${isMe ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-br-none' : 'glass-light text-zinc-100 rounded-bl-none'}">
        ${this.escapeHTML(text)}
      </div>
    `;
    cont.appendChild(div);
    cont.scrollTop = cont.scrollHeight;
  }

  showReaction(emoji, peerId) {
    const target = document.getElementById(`reactions-${peerId}`);
    if (!target) return;
    const el = document.createElement('div');
    el.className = 'absolute bottom-2 left-1/2 -translate-x-1/2 text-5xl pointer-events-none drop-shadow-2xl z-30';
    el.textContent = emoji;
    target.appendChild(el);
    if (window.gsap) {
      gsap.fromTo(el, { y: 20, scale: 0.5, opacity: 1 }, { y: -120, scale: 1.5, opacity: 0, duration: 1.8, ease: "power1.out", onComplete: () => el.remove() });
    } else {
      setTimeout(() => el.remove(), 1800);
    }
  }

  initOrUpdateYoutube(videoId, startSeconds, isPlaying) {
    if (!window.YT || !window.YT.Player) return;
    if (this.ytPlayer) {
      this.ytPlayer.loadVideoById({ videoId, startSeconds });
      if (!isPlaying) this.ytPlayer.pauseVideo();
    } else {
      this.ytPlayer = new YT.Player('yt-player', {
        height: '100%', width: '100%', videoId,
        playerVars: { autoplay: 1, controls: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: (e) => {
            this.isYtReady = true;
            e.target.seekTo(startSeconds, true);
            if (!isPlaying) e.target.pauseVideo();
          }
        }
      });
    }
  }

  async leaveRoom() {
    OracleAudio.play('transitionDown');
    if (this.socket) {
      this.socket.emit('leave_channel');
      this.socket.disconnect();
      this.socket = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.peers.forEach(pc => pc.close());
    this.peers.clear();

    try {
      if (window.Capacitor?.Plugins?.ForegroundService) await ForegroundService.stopForegroundService();
    } catch (e) {}

    document.getElementById('room-screen')?.classList.add('hidden');
    document.getElementById('lobby-screen')?.classList.remove('hidden');
  }

  escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
  }
}

// ═══ LOBBY & APP INITIALIZATION ═══
const room = new OracleRoom();

onAuthStateChanged(auth, async (user) => {
  window.yaireCurrentUser = user;
  const loader = document.getElementById('initial-loader');
  const lobby = document.getElementById('lobby-screen');
  const loginBtn = document.getElementById('vc-google-login-btn');

  if (loader) {
    loader.style.opacity = '0';
    setTimeout(() => loader.classList.add('hidden'), 500);
  }
  if (lobby) lobby.classList.remove('hidden');

  if (user) {
    // User Logged In
    if (loginBtn) {
      loginBtn.innerHTML = '<span class="text-base animate-bounce">🚀</span> <span>Entrar a la Sala Oracle P2P</span>';
      loginBtn.className = "w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-black font-black text-sm shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2.5 hover:scale-[1.02] active:scale-[0.98] transition-all";
      loginBtn.onclick = () => room.init();
    }

    // Fetch Handle
    try {
      const snap = await get(ref(db, `users/${user.uid}/oracleHandle`));
      if (snap.exists()) {
        window.yaireUserHandle = snap.val();
        const disp = document.getElementById('lobby-handle-display');
        if (disp) disp.textContent = `@${window.yaireUserHandle}`;
      }
    } catch (e) {}

  } else {
    // Needs Login
    if (loginBtn) {
      loginBtn.innerHTML = '<svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z"/></svg> <span>Conectar con Google</span>';
      loginBtn.onclick = async () => {
        loginBtn.innerHTML = '<div class="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin"></div> Abriendo Google...';
        try {
          const res = await FirebaseAuthentication.signInWithGoogle();
          const cred = GoogleAuthProvider.credential(res.credential.idToken, res.credential.accessToken);
          await signInWithCredential(auth, cred);
        } catch (err) {
          alert("Error de inicio de sesión: " + err.message);
          loginBtn.innerHTML = 'Conectar con Google';
        }
      };
    }
  }

  // Load Recent History
  const historyEl = document.getElementById('lobby-history');
  if (historyEl) {
    get(query(ref(db, 'oracle_history'), limitToLast(5))).then(snap => {
      if (snap.exists()) {
        const entries = [];
        snap.forEach(child => entries.push(child.val()));
        entries.reverse();
        historyEl.innerHTML = entries.map(e => `
          <div class="flex items-center gap-2.5 p-2 rounded-xl glass-light">
            <img src="${e.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(e.displayName || 'U')}&background=random`}" class="w-7 h-7 rounded-full object-cover shrink-0" />
            <div class="flex-1 min-w-0">
              <span class="text-xs font-extrabold text-white">${e.displayName || 'Usuario'}</span>
              <span class="text-[10px] text-zinc-400 ml-1">${e.action || 'está en Oracle'}</span>
            </div>
          </div>
        `).join('');
      } else {
        historyEl.innerHTML = '<div class="text-xs text-zinc-600 text-center py-4">Sala en silencio</div>';
      }
    }).catch(() => {
      historyEl.innerHTML = '<div class="text-xs text-zinc-600 text-center py-4">Listo para conectar</div>';
    });
  }
});

// Handle Modal Logic
document.getElementById('lobby-handle-btn')?.addEventListener('click', () => {
  document.getElementById('handle-modal')?.classList.remove('hidden');
});
document.getElementById('btn-cancel-handle')?.addEventListener('click', () => {
  document.getElementById('handle-modal')?.classList.add('hidden');
});
document.getElementById('btn-save-handle')?.addEventListener('click', async () => {
  const inp = document.getElementById('handle-input');
  const val = inp?.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!val || !window.yaireCurrentUser) return;
  window.yaireUserHandle = val;
  await set(ref(db, `users/${window.yaireCurrentUser.uid}/oracleHandle`), val);
  const disp = document.getElementById('lobby-handle-display');
  if (disp) disp.textContent = `@${val}`;
  document.getElementById('handle-modal')?.classList.add('hidden');
});
