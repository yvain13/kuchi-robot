# Kuchi 🤖

A voice-activated robot assistant with **always-listening mode**, animated Mochi-style expressions, real web search, and persistent memory.

## ✨ Features

- 🎤 **Voice Activated** - Tap to speak, hands-free conversation
- 🎨 **Retro LED Matrix Face** - Classic 16x8 glowing pixel display
- 🔍 **Real Web Search** - Powered by SerpAPI for current information
- 💾 **Memory System** - Remembers context about you from `memory.json`
- 🤖 **OpenAI GPT-4o-mini** - Intelligent conversations
- 📱 **Mobile Optimized** - Works great in landscape mode
- ⚡ **Super Light** - Runs entirely in browser, no backend

## 🎭 Robot Expressions

Kuchi has a **16x8 LED matrix display** with **9 different expressions**:

- 😊 **Idle** - Simple eyes, auto-blinking
- 👂 **Listening** - Open eyes with partial mouth
- 🤔 **Thinking** - Asymmetric eyes, question mark
- 💬 **Speaking** - Animated mouth opening/closing
- 😃 **Happy** - Wide smile, curved eyes (pink glow)
- 🤩 **Excited** - Star-shaped eyes, sparkles (pink glow)
- 😕 **Confused** - Uneven eyes, small question mark
- 😲 **Surprised** - Big round eyes, open mouth
- 😢 **Error** - X eyes, sad mouth (red glow)

**LED Colors:**
- Cyan (#00ffcc) - Normal expressions
- Pink (#ff66cc) - Happy/excited
- Red (#ff3333) - Error/sad

All faces are **retro LED matrix style** with glowing effects!

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd "Robot M"
npm install
```

### 2. Get API Keys

**OpenAI API Key:**
- Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- Create new key (starts with `sk-`)

**SerpAPI Key (for web search):**
- Go to [serpapi.com/manage-api-key](https://serpapi.com/manage-api-key)
- Sign up and get your free key

### 3. Run the App

```bash
npm run dev
```

Opens at `http://localhost:3000`

### 4. Configure

1. Click ⚙️ settings
2. Enter both API keys
3. Click Save

### 5. Start Talking!

**Tap-to-Speak Mode:**
- Tap the microphone button 🎤
- Speak your question
- Kuchi will respond automatically
- Tap again for next question

## 🎯 How It Works

### Tap-to-Speak Mode

```
Tap mic button 🎤
    ↓
Kuchi listens → Speech recognition active
    ↓
You speak → Speech detected
    ↓
Kuchi thinks → Calls OpenAI (may search web)
    ↓
Kuchi speaks → Plays response via TTS
    ↓
Returns to idle → Tap again for next question
```

**Simple and reliable!** Just tap and speak whenever you want.

### Web Search Integration

Kuchi uses **real web search** via SerpAPI:

```typescript
User: "What's the weather today?"
  ↓
OpenAI decides to use web_search tool
  ↓
SerpAPI searches Google
  ↓
Returns top 5 results + answer box
  ↓
OpenAI synthesizes answer
  ↓
Kuchi speaks the answer
```

### Memory System

Edit `public/memory.json` to personalize:

```json
{
  "user": {
    "name": "Your Name",
    "preferences": {
      "communication_style": "casual and friendly"
    },
    "notes": [
      "Loves TypeScript and Python",
      "Working on a robot project"
    ]
  },
  "facts": [
    "User prefers concise responses",
    "Interested in AI and robotics"
  ]
}
```

Kuchi loads this on startup and uses it for context!

## 📁 Project Structure

```
Robot M/
├── public/
│   └── memory.json          # User memory/context
├── src/
│   ├── main.ts              # Main app (always-listening)
│   ├── robot.ts             # Animated SVG faces
│   ├── voice.ts             # Speech API (continuous mode)
│   ├── openai.ts            # GPT + SerpAPI integration
│   └── styles.css           # Animations & UI
├── index.html
├── package.json
├── vite.config.ts
└── netlify.toml
```

## 🎨 Customization

### Change Personality

Edit [src/openai.ts](src/openai.ts#L59):

```typescript
content: 'You are Kuchi, a [YOUR PERSONALITY]...'
```

### Add New Face Expression

1. Add to `Expression` type in [src/robot.ts](src/robot.ts#L6)
2. Create SVG in `createFaceSVG()` method
3. Add animation if needed

### Adjust Voice

Edit [src/voice.ts](src/voice.ts#L126):

```typescript
utterance.rate = 1.2;   // Faster
utterance.pitch = 1.1;  // Higher
```

### Modify Memory

Edit `public/memory.json` with your preferences!

## 🌐 Deployment

### Netlify (Recommended)

```bash
# Build
npm run build

# Deploy
netlify deploy --prod
```

Or drag `dist` folder to [netlify.com/drop](https://app.netlify.com/drop)

### Other Platforms

- **Vercel**: `vercel deploy`
- **GitHub Pages**: Push `dist` folder
- **Any static host**: Upload `dist` folder

## 🔧 Development

```bash
# Install
npm install

# Dev server (hot reload)
npm run dev

# Build for production
npm run build

# Preview build
npm run preview
```

## 📱 Mobile Usage

1. Open in **Chrome mobile browser**
2. **Rotate to landscape** for best experience
3. Allow microphone permission
4. Configure API keys
5. Start talking!

**Tip:** Add to home screen for app-like experience!

## 🎤 Voice Commands Examples

**General:**
- "Hello Kuchi!"
- "What can you do?"
- "Tell me a joke"

**Web Search (automatic):**
- "What's the weather today?"
- "Who won the game yesterday?"
- "What's trending on Twitter?"

**Conversational:**
- "How are you?"
- "What do you think about AI?"
- "Help me brainstorm ideas"

## 💰 Cost Estimate

**OpenAI GPT-4o-mini:**
- Input: ~$0.15 per 1M tokens
- Output: ~$0.60 per 1M tokens
- Average conversation: **< $0.01**

**SerpAPI:**
- 100 free searches/month
- Then $50/month for 5000 searches
- Average search: **$0.01**

**Total:** Very affordable for personal use!

## 🛠️ Browser Support

| Browser | Support |
|---------|---------|
| Chrome Desktop | ✅ Full |
| Chrome Mobile | ✅ Full |
| Edge Desktop | ✅ Full |
| Safari Desktop | ⚠️ Limited (STT issues) |
| Safari Mobile | ⚠️ Limited (STT issues) |
| Firefox | ❌ Poor STT support |

**Recommended:** Chrome or Edge for best experience

## 🐛 Troubleshooting

### "Speech recognition not supported"
- Use Chrome or Edge
- Ensure HTTPS (localhost is OK)
- Check microphone permissions

### "Please configure API keys"
- Enter both OpenAI AND SerpAPI keys
- OpenAI key starts with `sk-`
- Save settings

### Not listening continuously
- Check console for errors
- Verify browser support
- Try refreshing page

### Web search not working
- Verify SerpAPI key is correct
- Check console for API errors
- Ensure you have free searches left

### Can't hear Kuchi
- Turn up device volume
- Disable Do Not Disturb
- Check browser isn't muted

## 🔒 Privacy & Security

- ✅ API keys stored locally (localStorage)
- ✅ No backend server
- ✅ No data collection
- ✅ Open source
- ⚠️ API calls to OpenAI & SerpAPI
- ⚠️ Consider backend proxy for production

## 🎯 Key Differences from Original Plan

### ✨ Improvements Made

1. **Tap-to-Speak** ✅
   - Simple button press to activate
   - Reliable voice detection
   - Clear visual feedback

2. **Retro LED Matrix Face** ✅
   - 16x8 pixel grid display
   - Glowing LED effects
   - Auto-blinking animation
   - Animated mouth for speaking
   - Color-coded emotions (cyan/pink/red)
   - Classic robot aesthetic!

3. **Real Web Search** ✅
   - SerpAPI integration
   - Actual Google results
   - Answer boxes
   - Top 5 results per search

4. **Memory System** ✅
   - Loads `memory.json` on start
   - Personalizes responses
   - Remembers user context

## 🚀 Future Enhancements

- [ ] Wake word detection ("Hey Kuchi")
- [ ] Voice activity detection (VAD)
- [ ] Multiple languages
- [ ] Custom voice selection
- [ ] Conversation export
- [ ] Backend for security
- [ ] More animated expressions
- [ ] Gesture animations

## 📝 License

MIT - Free to use and modify!

## 🙏 Credits

- Inspired by [Dasai Mochi](https://github.com/tamdilip/emote-buddy) animations
- Powered by [OpenAI](https://openai.com/)
- Search by [SerpAPI](https://serpapi.com/)
- Built with [Vite](https://vitejs.dev/)

---

**Enjoy your always-listening robot friend!** 🤖✨

Just open the app and start talking - Kuchi is always ready to chat!
