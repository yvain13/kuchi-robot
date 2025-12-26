# Developer Notes

## Project Overview

Kuchi is a web-based voice robot assistant with pixel-art expressions. Built with TypeScript, Vite, and OpenAI's API.

## Architecture

### Components

1. **main.ts** - Application controller
   - Initializes all components
   - Manages UI interactions
   - Handles settings and API key storage

2. **robot.ts** - Pixel-art face system
   - 16x16 bitmap patterns for each expression
   - 8 different facial expressions
   - Sentiment analysis for auto-expression selection

3. **voice.ts** - Web Speech API wrapper
   - Speech recognition (STT)
   - Speech synthesis (TTS)
   - Error handling and browser compatibility

4. **openai.ts** - AI agent integration
   - OpenAI API client
   - Conversation memory management
   - Web search tool (function calling)

### Flow Diagram

```
User taps mic
    ↓
Voice Manager starts listening (Listening face 👂)
    ↓
Speech recognized → Text captured
    ↓
Sent to OpenAI Agent (Thinking face 🤔)
    ↓
Agent processes (may call web_search tool)
    ↓
Response received
    ↓
Robot face changes based on sentiment
    ↓
Voice Manager speaks response (Speaking face 💬)
    ↓
Returns to idle state (Idle face 😊)
```

## Key Features

### Pixel-Art System

Each face is a 16x16 grid where:
- `1` = pixel on (visible)
- `0` = pixel off (transparent)

Rendered using CSS Grid with opacity control.

### Voice Recognition

Uses Web Speech API:
- **Browser support**: Chrome, Edge (full), Safari (partial)
- **Requires HTTPS** for microphone access
- **Continuous mode**: Off (single utterance per tap)

### Conversation Memory

- Stores last 20 messages (including system prompt)
- Automatically trims older messages to manage tokens
- Can be cleared via `agent.clearHistory()`

### Web Search Tool

Currently simulated. To enable real search:

```typescript
// In openai.ts, replace simulated search with:
const response = await fetch(`https://api.search-service.com/search`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${SEARCH_API_KEY}` },
  body: JSON.stringify({ query: searchQuery })
});
const data = await response.json();
```

## Development Tips

### Testing Locally

```bash
# Dev server with hot reload
npm run dev

# Test on mobile device (same network)
# Use your local IP instead of localhost
# Example: http://192.168.1.100:3000
```

### Browser DevTools

Enable verbose logging:
```javascript
// In main.ts, add:
console.log('User said:', text);
console.log('Agent response:', response);
```

### Testing Voice Features

**Microphone testing:**
1. Check browser console for permissions
2. Verify microphone in System Settings
3. Test with simple phrases first

**TTS testing:**
1. Check device volume
2. Test with short phrases
3. Monitor for rate/pitch issues

## Common Issues

### "Speech recognition not supported"
- Only works in Chrome/Edge
- Requires HTTPS (localhost is OK)
- Check `VoiceManager.isSupported()`

### API Key Issues
- Must start with `sk-`
- Stored in localStorage
- Check: `localStorage.getItem('kuchi_api_key')`

### CORS Errors
- OpenAI SDK needs `dangerouslyAllowBrowser: true`
- This is OK for client-side apps
- Consider backend proxy for production

## Customization Guide

### Change Robot Voice

```typescript
// In voice.ts, modify:
utterance.rate = 1.2;    // Faster speech
utterance.pitch = 1.1;   // Higher pitch
utterance.voice = voices[0]; // Different voice
```

### Add Expression

1. Create 16x16 bitmap pattern in `robot.ts`
2. Add to `Expression` type
3. Add to `facePatterns` object
4. Use in sentiment analysis

### Modify Personality

```typescript
// In openai.ts, system message:
'You are Kuchi, a [YOUR PERSONALITY HERE]...'
```

### Change Colors

```css
/* In styles.css */
.robot-face .pixel {
  background: #00ff00; /* Change pixel color */
}

body {
  background: #001100; /* Change background */
}
```

## Deployment Checklist

- [ ] Update API key handling (consider env vars)
- [ ] Test on target browsers
- [ ] Optimize bundle size
- [ ] Add error tracking (Sentry, LogRocket)
- [ ] Set up analytics (optional)
- [ ] Configure CSP headers
- [ ] Test mobile responsiveness
- [ ] Enable HTTPS
- [ ] Add loading states
- [ ] Implement rate limiting UI

## Performance Optimization

### Bundle Size
- OpenAI SDK is ~100KB gzipped
- Total bundle: ~150KB
- Consider code splitting for large additions

### API Optimization
- Conversation trimming at 20 messages
- Using gpt-4o-mini (cheaper, faster)
- Single API call per interaction

### Voice Optimization
- No buffering needed (streaming not used)
- TTS is browser-native (no data transfer)
- STT is browser-native (low latency)

## Security Considerations

### Current Setup
- ⚠️ API key in localStorage (browser only)
- ⚠️ Direct API calls from browser
- ✅ No backend to compromise
- ✅ No user data stored server-side

### Production Recommendations
1. Use backend proxy for API calls
2. Implement rate limiting
3. Add request signing
4. Use environment variables
5. Monitor API usage
6. Set spending limits on OpenAI

## Testing

### Manual Testing Checklist
- [ ] Settings modal opens/closes
- [ ] API key saves to localStorage
- [ ] Microphone permission requested
- [ ] Voice recognition captures speech
- [ ] OpenAI responds correctly
- [ ] TTS speaks response
- [ ] Face expressions change appropriately
- [ ] Error states display correctly
- [ ] Mobile landscape mode works
- [ ] Browser refresh maintains API key

### Browser Testing
- Chrome Desktop: ✅
- Chrome Mobile: ✅
- Edge Desktop: ✅
- Safari Desktop: ⚠️ (limited STT)
- Safari Mobile: ⚠️ (limited STT)
- Firefox: ❌ (poor STT support)

## Future Improvements

### Short Term
- Add loading animations
- Improve error messages
- Add voice selection UI
- Implement conversation export

### Medium Term
- Real web search integration
- Custom wake word detection
- Multi-language support
- Offline mode with basic responses

### Long Term
- Backend API with authentication
- User accounts and cloud sync
- Mobile app (Capacitor wrapper)
- Advanced animations
- Voice customization
- Plugin system

## Useful Resources

- [Web Speech API Docs](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [Vite Documentation](https://vitejs.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Netlify Deployment](https://docs.netlify.com/)

## License

MIT - Feel free to modify and distribute
