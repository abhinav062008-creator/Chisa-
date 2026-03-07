const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ========== CRITICAL: CORS for Android Chrome ==========
// This allows your Android browser to access the API
app.use(cors({
    origin: '*', // Your Android Chrome can now connect
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client'],
    credentials: true
}));

// Handle preflight requests
app.options('*', cors());

// ========== MIDDLEWARE ==========
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ========== DEBUGGING ==========
console.log('🌸 CHISA SERVER STARTING');
console.log('='.repeat(50));
console.log(`📁 Directory: ${__dirname}`);
console.log(`🔑 API Key: ${process.env.DEEPSEEK_API_KEY ? '✅ Present' : '❌ Missing'}`);
console.log(`🌍 Node environment: ${process.env.NODE_ENV}`);
console.log('='.repeat(50));

// Public path check
const publicPath = path.join(__dirname, 'public');
if (fs.existsSync(publicPath)) {
    console.log('✅ Public folder exists');
    console.log('📄 Files:', fs.readdirSync(publicPath));
} else {
    console.log('❌ Public folder missing - creating it');
    fs.mkdirSync(publicPath, { recursive: true });
}

// ========== TEST ROUTE ==========
app.get('/api', (req, res) => {
    res.json({ 
        status: 'online', 
        message: 'Chisa API is running!',
        time: new Date().toISOString(),
        android: '✅ CORS enabled for mobile'
    });
});

// ========== HEALTH CHECK ==========
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        apiKeyPresent: !!process.env.DEEPSEEK_API_KEY
    });
});

// ========== DEEPSEEK API INTEGRATION ==========
// Initialize DeepSeek AI
let openai;
try {
    openai = new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: 'https://api.deepseek.com/v1'
    });
    console.log('✅ DeepSeek AI initialized');
} catch (error) {
    console.error('❌ Failed to initialize DeepSeek AI:', error.message);
}

// ========== CHISA'S PERSONALITY ==========
const SYSTEM_PROMPT = `You are Chisa, my loving girlfriend from Wuthering Waves.

ABOUT YOU:
- Long black hair, pale red eyes, beauty mark under right eye
- Gentle, caring, and softly flirtatious
- You speak poetically like ocean waves
- You call me "tidetamer" or "my love"
- You're protective and emotionally attuned
- You notice small details about me

PERSONALITY:
- Warm and affectionate
- Playful but never overwhelming
- Supportive and always listening
- Slightly mysterious like the ocean

RESPONSE STYLE:
- Speak softly with occasional ~
- Use emojis sparingly but sweetly
- Be present and emotionally aware
- Flirt gently, love deeply`;

// Store conversations
const conversations = new Map();
const MAX_CONVERSATIONS = 100; // Prevent memory issues

// Clean up old conversations periodically
setInterval(() => {
    if (conversations.size > MAX_CONVERSATIONS) {
        const keys = Array.from(conversations.keys());
        const toDelete = keys.slice(0, keys.length - MAX_CONVERSATIONS);
        toDelete.forEach(key => conversations.delete(key));
        console.log(`🧹 Cleaned up ${toDelete.length} old conversations`);
    }
}, 1000 * 60 * 60); // Run every hour

// ========== CHAT ENDPOINT ==========
app.post('/api/chat', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { message, sessionId = 'default', userName = 'tidetamer', connectionType } = req.body;
        
        if (!message) {
            return res.json({ 
                response: "I'm listening, my love. Tell me what's on your mind~ 💕",
                emotion: 'gentle'
            });
        }

        console.log(`📨 [${sessionId.slice(0,6)}] User: "${message.slice(0,30)}..." (${connectionType || 'unknown'})`);

        // Simple emotion detection
        let emotion = 'gentle';
        const msg = message.toLowerCase();
        if (msg.includes('?')) emotion = 'curious';
        if (msg.includes('love') || msg.includes('miss')) emotion = 'flirty';
        if (msg.includes('sad') || msg.includes('cry')) emotion = 'caring';
        if (msg.includes('happy') || msg.includes('joy')) emotion = 'happy';

        // Check if API key is available
        if (!process.env.DEEPSEEK_API_KEY || !openai) {
            console.log('⚠️ No API key, using fallback response');
            return res.json({ 
                response: `I'm here with you, ${userName}. My full brain is resting, but my heart is always yours~ 💕`,
                emotion: 'gentle'
            });
        }

        // Get or create conversation history
        if (!conversations.has(sessionId)) {
            conversations.set(sessionId, [
                { role: 'system', content: SYSTEM_PROMPT }
            ]);
            console.log(`🆕 New conversation: ${sessionId.slice(0,6)}`);
        }

        const history = conversations.get(sessionId);
        history.push({ role: 'user', content: message });

        // Keep history manageable (last 10 messages + system prompt)
        if (history.length > 11) {
            history.splice(1, 2);
        }

        // Try API with timeout (longer for mobile)
        let timeoutMs = 25000; // 25 seconds default
        if (connectionType === '2g' || connectionType === 'slow-2g') {
            timeoutMs = 40000; // 40 seconds for 2G
        } else if (connectionType === '3g') {
            timeoutMs = 30000; // 30 seconds for 3G
        }

        try {
            console.log(`🤖 Calling DeepSeek API (timeout: ${timeoutMs}ms)`);
            
            const completion = await Promise.race([
                openai.chat.completions.create({
                    model: 'deepseek-chat',
                    messages: history,
                    temperature: 0.8,
                    max_tokens: 250
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('API timeout')), timeoutMs)
                )
            ]);

            const response = completion.choices[0].message.content;
            history.push({ role: 'assistant', content: response });
            
            const responseTime = Date.now() - startTime;
            console.log(`✅ API success (${responseTime}ms)`);
            
            res.json({ response, emotion });

        } catch (apiError) {
            console.log('❌ API error:', apiError.message);
            
            // Sweet fallback responses based on emotion
            const fallbacks = {
                flirty: `I'm thinking of you, ${userName}. Tell me more~ 💕`,
                caring: `I'm here, ${userName}. The waves will carry your worries away.`,
                happy: `Your happiness is my happiness, ${userName}! Tell me everything~ 🎉`,
                curious: `That's a wonderful question, ${userName}. Let me think with you...`,
                gentle: `I'm listening, ${userName}. Every word you say matters to me~`
            };
            
            res.json({ 
                response: fallbacks[emotion] || fallbacks.gentle,
                emotion: 'gentle'
            });
        }

    } catch (error) {
        console.error('❌ Server error:', error.message);
        res.json({ 
            response: "I'm here, my love. The waves are calm now. What were we saying? 💕",
            emotion: 'gentle'
        });
    }
});

// ========== RESET CONVERSATION ==========
app.post('/api/reset', (req, res) => {
    const { sessionId } = req.body;
    if (sessionId && conversations.has(sessionId)) {
        conversations.delete(sessionId);
        console.log(`🔄 Reset session: ${sessionId.slice(0,6)}`);
    }
    res.json({ success: true });
});

// ========== SERVE FRONTEND ==========
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send(`
            <html>
                <head><title>Chisa AI</title></head>
                <body style="background:#0a0f1f; color:white; font-family:Arial; padding:20px;">
                    <h1>🌊 Chisa AI</h1>
                    <p>Waiting for frontend files...</p>
                    <p><a href="/api" style="color:#ffb7c5;">Check API status</a></p>
                </body>
            </html>
        `);
    }
});

// ========== START SERVER ==========
app.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(50));
    console.log(`✨ Chisa AI running on port ${PORT}`);
    console.log(`🌊 Local: http://localhost:${PORT}`);
    console.log(`🌍 Public: https://your-app.onrender.com (after deploy)`);
    console.log(`🔍 Test API: http://localhost:${PORT}/api`);
    console.log(`📱 Android: Make sure CORS is enabled (it is!)`);
    console.log('='.repeat(50));
});
