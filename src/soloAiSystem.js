
// Main Application Controller
export class SoloAISystem {
  constructor() {
    this.initialized = false;
    this.listening = false;
    this.processing = false;
    this.conversation = [];
    this.audioContext = null;
    this.visualizer = null;
    this.speechRecognition = null;

    this.openRouterKey = "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";

    this.initUI();
    this.initialize();
  }

  initUI() {
    this.elements = {
      startListeningBtn: document.getElementById('startListening'),
      stopListeningBtn: document.getElementById('stopListening'),
      clearChatBtn: document.getElementById('clearChat'),
      transcript: document.getElementById('transcript'),
      listeningIndicator: document.getElementById('listeningIndicator'),
      thinkingIndicator: document.getElementById('thinkingIndicator'),
      systemStatus: document.getElementById('systemStatus'),
      listeningStatus: document.getElementById('listeningStatus'),
      processingStatus: document.getElementById('processingStatus'),
    };

    this.elements.startListeningBtn.addEventListener('click', () => this.startListening());
    this.elements.stopListeningBtn.addEventListener('click', () => this.stopListening());
  }

  async initialize() {
    this.updateDebug('system', 'Initializing Solo AI System...');

    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.updateDebug('system', 'Audio context initialized');
    } catch (error) {
      this.updateDebug('system', 'Error initializing audio context: ' + error.message);
    }

    this.visualizer = new ThreeJSVisualizer(this.audioContext);
    this.updateDebug('system', 'Visualizer initialized');

    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.speechRecognition = new SpeechRecognition();
      this.speechRecognition.continuous = true;
      this.speechRecognition.interimResults = true;

      this.speechRecognition.onstart = () => {
        this.listening = true;
        this.updateListeningUI(true);
        this.updateDebug('speech', 'Speech recognition started');
      };

      this.speechRecognition.onend = () => {
        if (this.listening) {
          this.speechRecognition.start();
          this.updateDebug('speech', 'Speech recognition restarted');
        } else {
          this.updateListeningUI(false);
          this.updateDebug('speech', 'Speech recognition stopped');
        }
      };

      this.speechRecognition.onresult = (event) => {
        const result = event.results[event.results.length - 1];
        if (result.isFinal) {
          const transcript = result[0].transcript.trim();
          if (transcript) {
            this.handleUserInput(transcript);
          }
        }
      };

      this.speechRecognition.onerror = (event) => {
        this.updateDebug('speech', 'Speech recognition error: ' + event.error);
      };

      this.updateDebug('speech', 'Speech recognition initialized');
    } else {
      this.updateDebug('speech', 'Speech recognition not supported in this browser');
    }


    this.addMessage('system', 'hi (users name)');
    // this.speakResponse('hi shono.');

    this.initialized = true;
    this.updateDebug('system', 'SOLO AI System initialized and ready');
  }

  startListening() {
    if (!this.initialized) {
      this.initialize();
      return;
    }

    if (this.speechRecognition) {
      this.listening = true;
      this.speechRecognition.start();
      this.elements.startListeningBtn.style.display = 'none';
      this.elements.stopListeningBtn.style.display = 'flex';
      this.elements.listeningIndicator.classList.add('active');
      this.elements.listeningStatus.classList.add('active');
    }
  }

  stopListening() {
    if (this.speechRecognition) {
      this.listening = false;
      this.speechRecognition.stop();
      this.elements.startListeningBtn.style.display = 'flex';
      this.elements.stopListeningBtn.style.display = 'none';
      this.elements.listeningIndicator.classList.remove('active');
      this.elements.listeningStatus.classList.remove('active');
    }
  }   
    
  updateListeningUI(isListening) {
    this.elements.listeningStatus.className = isListening ? 'status-dot active' : 'status-dot inactive';
    this.elements.listeningIndicator.classList.toggle('active', isListening);
    this.elements.startListeningBtn.style.display = isListening ? 'none' : 'flex';
    this.elements.stopListeningBtn.style.display = isListening ? 'flex' : 'none';
  }

  updateProcessingUI(isProcessing) {
    this.processing = isProcessing;
    this.elements.processingStatus.className = isProcessing ? 'status-dot active' : 'status-dot inactive';
    this.elements.thinkingIndicator.classList.toggle('active', isProcessing);
    this.visualizer.setProcessingMode(isProcessing);
  }

  extractQuestDetails(text) {
    const match = text.match(/create daily quest to (.+) (\d+) (\w+)/i);
    if (match) {
      return {
        type: 'daily',
        title: match[1],
        count: parseInt(match[2], 10),
        metric: match[3],
        description: `Auto-generated daily quest via AI`,
      };
    }
    return null;
  }
  
  extractWindowId(text) {
    const windows = Object.keys(windowSystem.windows);
    return windows.find(id => text.toLowerCase().includes(id.toLowerCase()));
  }
  
  extractBossId(text) {
    const match = text.match(/start boss battle against (\w+)/i);
    return match ? match[1] : null;
  }
  async handleUserInput(text) {
    if (this.processing) return;
  
    this.addMessage('user', text);
    this.updateProcessingUI(true);
  
    try {
      let response;
      const lowerText = text.toLowerCase();
  
      // Command handling
      if (lowerText.includes('create daily quest')) {
        const questDetails = this.extractQuestDetails(text);
        if (questDetails) {
          const questId = await createQuest(questDetails);
          response = `Daily quest "${questDetails.title}" created successfully!`;
        } else {
          response = 'Please specify the quest title, count, and metric (e.g., "Create daily quest to run 5 km").';
        }
      } else if (lowerText.includes('open') && lowerText.includes('window')) {
        const windowId = this.extractWindowId(text);
        if (windowId && windowSystem.windows[windowId]) {
          windowSystem.showWindow(windowId);
          response = `${windowId} window opened.`;
        } else {
          response = 'Please specify a valid window to open (e.g., "Open quest window").';
        }
      } else if (lowerText.includes('close') && lowerText.includes('window')) {
        const windowId = this.extractWindowId(text);
        if (windowId && windowSystem.windows[windowId]) {
          windowSystem.hideWindow(windowId);
          response = `${windowId} window closed.`;
        } else {
          response = 'Please specify a valid window to close (e.g., "Close quest window").';
        }
      } else if (lowerText.includes('start boss battle')) {
        const bossId = this.extractBossId(text);
        if (bossId && Object.values(BOSSES).some(b => b.id === bossId)) {
          await startBossBattle([bossId]);
          response = `Boss battle against ${bossId} started!`;
        } else {
          response = 'Please specify a valid boss ID (e.g., "Start boss battle against step_master").';
        }
      } else if (lowerText.includes('show inventory')) {
        showInventory();
        response = 'Inventory displayed.';
      } else if (lowerText.includes('show shop')) {
        showShop();
        response = 'Shop opened.';
      } else if (lowerText.includes('show achievements')) {
        showAchievements();
        response = 'Achievements displayed.';
      } else if (lowerText.includes('show rank progress')) {
        showRankProgress();
        response = 'Rank progress displayed.';
      } else {
        // Fallback to DeepSeek API for general queries
        response = await this.callDeepSeekAPI(text);
      }
  
      this.addMessage('ai', response);
      await this.speakResponse(response);
    } catch (error) {
      this.updateDebug('api', 'Error processing request: ' + error.message);
      this.addMessage('system', 'Sorry, I encountered an error processing your request.');
    } finally {
      this.updateProcessingUI(false);
    }
  }
  
  async callDeepSeekAPI(text) {
    try {
      const conversationHistory = this.formatConversationForDeepSeek();
      conversationHistory.push({ role: 'user', content: text });

      const url = 'https://openrouter.ai/api/v1/chat/completions';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openRouterKey}`,
          'HTTP-Referer': 'http://localhost',
          'X-Title': 'SOLO AI System',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'deepseek/deepseek-chat:free',
          messages: conversationHistory,
          max_tokens: 250,
          temperature: 0.7,
          top_p: 0.9
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const result = await response.json();
      if (result && result.choices && result.choices[0] && result.choices[0].message) {
        return result.choices[0].message.content.trim();
      } else {
        console.error('Unexpected API response format:', result);
        return "I'm processing your request. The SOLO AI System is actively analyzing the information.";
      }
    } catch (error) {
      console.error('Error calling DeepSeek API:', error);
      return "I'm experiencing some connection issues. Please try again in a moment.";
    }
  }

  formatConversationForDeepSeek() {
    const formattedConversation = [];
    formattedConversation.push({
      role: 'system',
      content: `You are SOLO, an AI assistant for a fitness and well-being app inspired by Solo Leveling. You can control the website by:
      - Creating daily quests (e.g., "Create daily quest to run 5 km")
      - Opening windows (e.g., "Open quest window")
      - Closing windows (e.g., "Close quest window")
      - Starting boss battles (e.g., "Start boss battle against step_master")
      - Showing inventory, shop, achievements, or rank progress (e.g., "Show inventory")
      For other queries, provide helpful responses related to fitness and well-being. Do not use asterisks, markdown, or emojis in your responses.`
    });
  
    const recentConversation = this.conversation.slice(-10);
    for (const msg of recentConversation) {
      if (msg.type === 'user') {
        formattedConversation.push({ role: 'user', content: msg.text });
      } else if (msg.type === 'ai') {
        formattedConversation.push({ role: 'assistant', content: msg.text });
      }
    }
    return formattedConversation;
  }

  async speakResponse(text) {
    try {
      this.updateDebug('audio', 'Requesting speech from Azure TTS API...');
      const tokenResponse = await fetch(`https://eastus.api.cognitive.microsoft.com/sts/v1.0/issuetoken`, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': "FANcfK9JLli9bfNboMTIVRIhY3a6BJJf1ifjGP4gUwylRN00Bez0JQQJ99BCACYeBjFXJ3w3AAAYACOG4YgF"
        }
      });
  
      if (!tokenResponse.ok) {
        throw new Error(`Failed to get token: ${tokenResponse.status}`);
      }
  
      const accessToken = await tokenResponse.text();
      const ttsUrl = `https://eastus.tts.speech.microsoft.com/cognitiveservices/v1`;
  
      const audioResponse = await fetch(ttsUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3'
        },
        body: `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>
                 <voice name='en-US-AriaNeural'>${text}</voice>
               </speak>`
      });
  
      if (!audioResponse.ok) {
        throw new Error(`Azure TTS request failed with status ${audioResponse.status}`);
      }
  
      const audioBlob = await audioResponse.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
  
      // Connect audio source to the analyzer and destination
      const source = this.audioContext.createMediaElementSource(audio);
      source.connect(this.audioContext.destination);
      source.connect(this.visualizer.analyzer);
  
      this.visualizer.setActiveMode(true);
      audio.onended = () => {
        this.visualizer.setActiveMode(false);
        source.disconnect();
      };
  
      // Append a new AI message element to transcript and apply typewriter effect
      const messageElement = document.createElement('div');
      // Add a prefix for AI messages (optional)
      messageElement.innerHTML = `<strong>AI:</strong> `;
      this.elements.transcript.appendChild(messageElement);
      // Ensure the transcript scrolls to the bottom as new messages are added
      this.elements.transcript.scrollTop = this.elements.transcript.scrollHeight;
  
      // Use the typeWriter function to animate the text within the new message element
      typeWriter(text, messageElement, 250);
  
      await audio.play();
    } catch (error) {
      this.updateDebug('audio', 'Error generating or playing speech: ' + error.message);
      console.error('Speech synthesis error:', error);
    }
  }
  
  addMessage(type, text) {
    if (this.conversation.length > 0 && this.conversation[this.conversation.length - 1].text === text) {
      return; // Prevent duplicate messages
    }

    this.conversation.push({ type, text });

    const messageElement = document.createElement('div');
    messageElement.style.marginBottom = '10px';

    if (type === 'user') {
      messageElement.innerHTML = `<strong>You:</strong> ${text}`;
    } else if (type === 'ai') {
      messageElement.innerHTML = `<strong>AI:</strong> ${text}`;
    } else {
      messageElement.innerHTML = `<strong>System:</strong> ${text}`;
    }

    this.elements.transcript.appendChild(messageElement);
    this.elements.transcript.scrollTop = this.elements.transcript.scrollHeight;
  }

  updateDebug(section, message) {
    const debugMap = {
      system: document.getElementById('debugSystem'),
      speech: document.getElementById('debugSpeech'),
      api: document.getElementById('debugAPI'),
      audio: document.getElementById('debugAudio')
    };
    if (debugMap[section]) {
      debugMap[section].textContent = message;
    }
  }
}


export class ThreeJSVisualizer {
    constructor(audioContext) {
      this.audioContext = audioContext;
      this.analyzer = this.audioContext.createAnalyser();
      this.analyzer.fftSize = 256; // Smaller FFT size for more responsive visualization
      this.isActive = false;
      this.isProcessing = false;
  
      // Scene setup
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      this.camera.position.z = 5;
  
      // Renderer setup
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(window.devicePixelRatio);
      this.renderer.domElement.style.position = 'absolute';
      this.renderer.domElement.style.top = '0';
      this.renderer.domElement.style.left = '0';
      this.renderer.domElement.style.width = '100%';
      this.renderer.domElement.style.height = '100%';
      this.renderer.domElement.style.zIndex = '-1';
      const soloContainer = document.getElementById('soloContainer');
      document.body.appendChild(this.renderer.domElement);
  
      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
      this.scene.add(ambientLight);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
      directionalLight.position.set(1, 1, 1);
      this.scene.add(directionalLight);
  
      // Sphere creation with increased detail
      const geometry = new THREE.IcosahedronGeometry(2, 1);
      this.geometry = geometry; // Store geometry for vertex analysis
      const material = new THREE.MeshPhongMaterial({
        color: 0x03befc,
        specular: 0x666666,
        shininess: 10,
        transparent: true,
        opacity: 0.5,
        wireframe: false
      });
      this.sphere = new THREE.Mesh(geometry, material);
  
      // Wireframe
      const wireframeGeometry = new THREE.WireframeGeometry(geometry);
      const wireframeMaterial = new THREE.LineBasicMaterial({
        color: 0x03befc,
        transparent: true,
        opacity: 0.9
      });
      const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
      this.sphere.add(wireframe);
      this.scene.add(this.sphere);
  
      // Store original vertex positions
      this.originalPositions = [];
      const positions = geometry.attributes.position.array;
      
      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const y = positions[i + 1];
        const z = positions[i + 2];
        this.originalPositions.push({ x, y, z });
      }
      
      // Audio data buffers
      this.bufferLength = this.analyzer.frequencyBinCount;
      this.dataArray = new Uint8Array(this.bufferLength);
  
      // Bind and start animation
      this.animate = this.animate.bind(this);
      this.animate();
  
      // Handle window resize
      window.addEventListener('resize', () => {
        if (soloContainer) {
          const width = soloContainer.clientWidth;
          const height = soloContainer.clientHeight;
          this.renderer.setSize(width, height);
          this.camera.aspect = width / height;
          this.camera.updateProjectionMatrix();
        }
      });
    }
  
    setActiveMode(active) {
      this.isActive = active;
    }
  
    setProcessingMode(isProcessing) {
      this.isProcessing = isProcessing;
      const color = isProcessing ? 0xffff00 : 0x03befc;
      this.sphere.material.color.set(color);
      if (this.sphere.children[0]) {
        this.sphere.children[0].material.color.set(color);
      }
    }
  
    updateWireframe() {
      if (this.sphere.children.length > 0) {
        this.sphere.remove(this.sphere.children[0]);
      }
      const wireframeGeometry = new THREE.WireframeGeometry(this.sphere.geometry);
      const wireframeMaterial = new THREE.LineBasicMaterial({
        color: this.sphere.material.color.getHex(),
        transparent: true,
        opacity: 0.9
      });
      const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
      this.sphere.add(wireframe);
    }
  
    animate() {
      requestAnimationFrame(this.animate);
  
      if (this.isActive) {
        this.analyzer.getByteFrequencyData(this.dataArray);
  
        let sum = 0;
        for (let i = 0; i < this.bufferLength; i++) {
          sum += this.dataArray[i];
        }
        const average = sum / this.bufferLength;
  
        // Calculate frequency bands more evenly
        const numBands = 6; // Use more bands for smoother distribution
        const bandSize = Math.floor(this.bufferLength / numBands);
        const bands = [];
        
        for (let i = 0; i < numBands; i++) {
          let bandSum = 0;
          const start = i * bandSize;
          const end = i === numBands - 1 ? this.bufferLength : (i + 1) * bandSize;
          
          for (let j = start; j < end; j++) {
            bandSum += this.dataArray[j];
          }
          
          // Normalize to 0-1 and apply slight curve for more responsiveness
          bands[i] = Math.pow(bandSum / (end - start) / 255, 0.9) * 0.8;
        }
  
        const positionAttribute = this.sphere.geometry.attributes.position;
        
        // Apply frequency data to vertices based on their position
        for (let i = 0; i < this.originalPositions.length; i++) {
          const vertex = this.originalPositions[i];
          
          // Normalize the vertex position to use as a coordinate
          const length = Math.sqrt(vertex.x * vertex.x + vertex.y * vertex.y + vertex.z * vertex.z);
          const nx = vertex.x / length;
          const ny = vertex.y / length;
          const nz = vertex.z / length;
          
          // Mix multiple frequency bands based on vertex position
          // This ensures each vertex responds to multiple frequencies
          // Use a weighted combination based on 3D position
          
          // Use absolute coordinates for more even distribution
          const xFactor = Math.abs(nx); 
          const yFactor = Math.abs(ny);
          const zFactor = Math.abs(nz);
          
          // Use a weighted mix of bands based on position
          let bandIndex1 = Math.floor(xFactor * (numBands - 1));
          let bandIndex2 = Math.floor(yFactor * (numBands - 1));
          let bandIndex3 = Math.floor(zFactor * (numBands - 1));
          
          // Ensure valid indices
          bandIndex1 = Math.min(Math.max(0, bandIndex1), numBands - 1);
          bandIndex2 = Math.min(Math.max(0, bandIndex2), numBands - 1);
          bandIndex3 = Math.min(Math.max(0, bandIndex3), numBands - 1);
          
          // Get the band values
          const band1 = bands[bandIndex1] || 0;
          const band2 = bands[bandIndex2] || 0;
          const band3 = bands[bandIndex3] || 0;
          
          // Mix the bands - weight by the factor values to ensure distribution
          // This approach ensures all vertices get some movement
          const amplitude = (band1 * xFactor + band2 * yFactor + band3 * zFactor) / (xFactor + yFactor + zFactor);
          
          // Scale factor calculation - base scale + amplitude influence
          const scale = 1 + (amplitude * 0.6); // Moderate effect
          
          // Apply scaling
          positionAttribute.setXYZ(
            i,
            vertex.x * scale,
            vertex.y * scale,
            vertex.z * scale
          );
        }
        
        positionAttribute.needsUpdate = true;
        this.updateWireframe();
        
        // Update emissive properties based on audio level
        const intensity = Math.min(average / 128, 2);
        this.sphere.material.emissive.setRGB(intensity * 0.1, intensity * 0.1, intensity * 0.2);
      } else {
        // Reset to original positions when not active
        const positionAttribute = this.sphere.geometry.attributes.position;
        for (let i = 0; i < this.originalPositions.length; i++) {
          const vertex = this.originalPositions[i];
          positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
        }
        positionAttribute.needsUpdate = true;
        this.updateWireframe();
        this.sphere.material.emissive.setRGB(0, 0, 0);
      }
  
      this.sphere.rotation.y += 0.001;
      this.sphere.rotation.x += 0.001;
  
      this.renderer.render(this.scene, this.camera);
    }
  }
  