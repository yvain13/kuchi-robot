# 🚀 Kuchi Quick Start

Get your robot assistant running in 3 minutes!

## Step 1: Get OpenAI API Key

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Sign in or create account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)

## Step 2: Install & Run

```bash
# Navigate to project
cd "Robot M"

# Install dependencies (first time only)
npm install

# Start development server
npm run dev
```

The app opens at `http://localhost:3000` ✨

## Step 3: Configure

1. Click ⚙️ settings icon
2. Paste your API key
3. Click Save

## Step 4: Start Talking!

1. Tap 🎤 microphone button
2. Allow microphone permission
3. Speak your question
4. Watch Kuchi respond! 🤖

---

## Example Questions

Try asking:
- "Hello Kuchi!"
- "What can you do?"
- "Tell me a joke"
- "Explain TypeScript"

## Mobile Usage

1. Open in Chrome browser
2. **Rotate to landscape** 📱↻
3. Tap mic and speak
4. Enjoy!

## Deploy to Netlify (Optional)

```bash
# Build
npm run build

# Deploy
netlify deploy --prod
```

Or drag `dist` folder to [netlify.com/drop](https://app.netlify.com/drop)

---

**Need help?** Check [README.md](README.md) for full documentation

**Issues?** Make sure:
- ✅ Using Chrome or Edge
- ✅ API key starts with `sk-`
- ✅ Microphone permission granted
- ✅ HTTPS connection (required for mic)
