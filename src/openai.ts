/**
 * OpenAI Agent API Integration
 * Uses real web search via SerpAPI and memory.json for context
 */

import OpenAI from 'openai';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface UserMemory {
  version: string;
  user: {
    name: string;
    preferences: {
      communication_style: string;
      topics_of_interest: string[];
    };
    context: string;
    notes: string[];
  };
  facts: string[];
  last_updated: string;
  created: string;
}

export class KuchiAgent {
  private client: OpenAI;
  private conversationHistory: Message[] = [];
  private serpApiKey: string;
  private userMemory: UserMemory | null = null;

  constructor(apiKey: string, serpApiKey: string) {
    this.client = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true, // Required for browser usage
    });
    this.serpApiKey = serpApiKey;

    // Load memory and initialize
    this.initializeWithMemory();
  }

  /**
   * Load memory.json and initialize system prompt
   */
  private async initializeWithMemory(): Promise<void> {
    console.log('\n🧠 ========== MEMORY INITIALIZATION ==========');
    try {
      // Try localStorage first
      const localMemory = this.loadMemoryFromLocalStorage();
      if (localMemory) {
        this.userMemory = localMemory;
        console.log('📝 ✅ Loaded memory from localStorage');
        console.log('📝 Memory Details:');
        console.log('   - Version:', localMemory.version);
        console.log('   - User name:', localMemory.user.name || '(empty)');
        console.log('   - Communication style:', localMemory.user.preferences.communication_style);
        console.log('   - Topics of interest:', localMemory.user.preferences.topics_of_interest.join(', ') || '(none)');
        console.log('   - User notes count:', localMemory.user.notes.length);
        console.log('   - Facts count:', localMemory.facts.length);
        console.log('   - Last updated:', localMemory.last_updated);
        console.log('   - Created:', localMemory.created);
      } else {
        // Fall back to fetching memory.json
        console.log('📝 No localStorage memory found, fetching memory.json...');
        const response = await fetch('/memory.json');
        this.userMemory = await response.json();
        console.log('📝 ✅ Loaded memory from memory.json');
        
      }

      // Build enhanced system message with memory context
      const memoryContext = this.buildMemoryContext();
      console.log('\n📝 Memory Context Built:');
      console.log('-----------------------------------');
      console.log(memoryContext);
      console.log('-----------------------------------\n');

      this.conversationHistory.push({
        role: 'system',
        content:
          'You are Kuchi, a friendly robot assistant with expressive animated faces. ' +
          'Keep responses conversational, warm, and concise since they will be spoken aloud. ' +
          'Use simple language and be helpful. When you need current information, use web search.\n\n' +
          memoryContext,
      });

      console.log('🧠 ✅ Memory initialized successfully');
      console.log('🧠 ========================================\n');
    } catch (error) {
      console.error('❌ Failed to load memory:', error);
      // Fallback to basic system message
      this.conversationHistory.push({
        role: 'system',
        content:
          'You are Kuchi, a friendly robot assistant. ' +
          'Keep responses conversational and concise for voice output.',
      });
      console.log('⚠️  Using fallback system message (no memory)');
      console.log('🧠 ========================================\n');
    }
  }

  /**
   * Build context from memory.json
   */
  private buildMemoryContext(): string {
    if (!this.userMemory) return '';

    let context = '=== USER CONTEXT ===\n';
    context += `User Name: ${this.userMemory.user.name}\n`;
    context += `Communication Style: ${this.userMemory.user.preferences.communication_style}\n`;

    if (this.userMemory.user.notes.length > 0) {
      context += `\nNotes about user:\n`;
      this.userMemory.user.notes.forEach((note) => {
        context += `- ${note}\n`;
      });
    }

    if (this.userMemory.facts.length > 0) {
      context += `\nKey Facts:\n`;
      this.userMemory.facts.forEach((fact) => {
        context += `- ${fact}\n`;
      });
    }

    context += '\nUse this context to personalize your responses.';
    return context;
  }

  /**
   * Perform real web search using SerpAPI
   */
  private async performWebSearch(query: string): Promise<string> {
    try {
      // Use SerpAPI with CORS proxy to bypass browser restrictions
      const url = new URL('https://serpapi.com/search');
      url.searchParams.append('api_key', this.serpApiKey);
      url.searchParams.append('engine', 'google');
      url.searchParams.append('q', query);
      url.searchParams.append('num', '5');

      // Use CORS proxy
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url.toString())}`;

      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`Search API error: ${response.statusText}`);
      }

      const results = await response.json();

      // Extract organic results
      if (results.organic_results && results.organic_results.length > 0) {
        let searchSummary = `Search results for "${query}":\n\n`;

        results.organic_results.slice(0, 5).forEach((result: any, index: number) => {
          searchSummary += `${index + 1}. ${result.title}\n`;
          if (result.snippet) {
            searchSummary += `   ${result.snippet}\n`;
          }
          searchSummary += `   Source: ${result.link}\n\n`;
        });

        // Add answer box if available
        if (results.answer_box) {
          searchSummary = `Quick Answer: ${results.answer_box.answer || results.answer_box.snippet}\n\n${searchSummary}`;
        }

        return searchSummary;
      }

      return `No results found for "${query}".`;
    } catch (error: any) {
      console.error('Search error:', error);
      return `Search failed: ${error.message}. Please try a different query.`;
    }
  }

  /**
   * Send a message and get response from the agent
   */
  async sendMessage(userMessage: string): Promise<string> {
    console.log('\n💬 ========== SENDING MESSAGE ==========');
    console.log('👤 User:', userMessage);
    console.log('📊 Conversation history length before message:', this.conversationHistory[this.conversationHistory.length - 1].content);
    console.log('📊 Conversation history length:', this.conversationHistory.length);

    try {
      // Add user message to history
      this.conversationHistory.push({
        role: 'user',
        content: userMessage,
      });
      console.log('✅ User message added to history');

      // Call OpenAI with web_search tool
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: this.conversationHistory,
        tools: [
          {
            type: 'function',
            function: {
              name: 'web_search',
              description:
                'Search the web for current information, news, facts, weather, or any real-time data. ' +
                'Use this when the user asks about recent events, current conditions, or information you may not have.',
              parameters: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: 'The search query to execute on Google',
                  },
                },
                required: ['query'],
              },
            },
          },
          {
            type: 'function',
            function: {
              name: 'play_music',
              description:
                'Play background music when the user asks to play music, play a song, or hear music. ' +
                'Use this when user requests music playback.',
              parameters: {
                type: 'object',
                properties: {},
                required: [],
              },
            },
          },
        ],
      });

      const assistantMessage = response.choices[0].message;

      // Handle function calls (web search or music)
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        const toolCall = assistantMessage.tool_calls[0];
        const functionName = toolCall.function.name;

        // Handle web_search tool
        if (functionName === 'web_search') {
          const searchQuery = JSON.parse(toolCall.function.arguments).query;

          console.log(`🔍 Searching: "${searchQuery}"`);

          // Perform real web search
          const searchResults = await this.performWebSearch(searchQuery);

          // Add assistant's tool call to history
          this.conversationHistory.push({
            role: 'assistant',
            content: assistantMessage.content || `Searching for: ${searchQuery}`,
          });

          // Get final response with search results
          const finalResponse = await this.client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              ...this.conversationHistory,
              {
                role: 'user',
                content: `Here are the search results:\n\n${searchResults}\n\nPlease provide a helpful, concise spoken response based on these results.`,
              },
            ],
          });

          const finalMessage =
            finalResponse.choices[0].message.content || "I couldn't process the search results.";

          this.conversationHistory.push({
            role: 'assistant',
            content: finalMessage,
          });

          return finalMessage;
        }

        // Handle play_music tool
        if (functionName === 'play_music') {
          console.log('🎵 Music playback requested');

          // Return special marker that main.ts will detect
          const musicResponse = '🎵PLAY_MUSIC🎵';

          this.conversationHistory.push({
            role: 'assistant',
            content: 'Playing music for you!',
          });

          return musicResponse;
        }
      }

      // No function call, just return the response
      const responseText = assistantMessage.content || "I'm not sure how to respond.";

      this.conversationHistory.push({
        role: 'assistant',
        content: responseText,
      });

      console.log('🤖 Kuchi:', responseText);
      console.log('📊 Conversation history length after response:', this.conversationHistory.length);

      // Manage conversation history length
      this.trimHistory();
      if (this.conversationHistory.length <= 20) {
        console.log('📊 History within limits');
      } else {
        console.log('✂️  Trimmed history to:', this.conversationHistory.length, 'messages');
      }

      console.log('💬 ========================================\n');
      return responseText;
    } catch (error: any) {
      console.error('OpenAI API Error:', error);

      if (error.status === 401) {
        throw new Error('Invalid API key. Please check your settings.');
      } else if (error.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      } else {
        throw new Error(`Error: ${error.message || 'Failed to get response'}`);
      }
    }
  }

  /**
   * Trim conversation history to prevent token overflow
   */
  private trimHistory(): void {
    if (this.conversationHistory.length > 20) {
      const systemMsg = this.conversationHistory[0];
      const recentMessages = this.conversationHistory.slice(-19);
      this.conversationHistory = [systemMsg, ...recentMessages];
    }
  }

  /**
   * Clear conversation history (except system message)
   */
  clearHistory(): void {
    const systemMsg = this.conversationHistory[0];
    this.conversationHistory = [systemMsg];
  }

  /**
   * Get current conversation history
   */
  getHistory(): Message[] {
    return [...this.conversationHistory];
  }

  /**
   * Get current user memory
   */
  getMemory(): UserMemory | null {
    return this.userMemory;
  }

  /**
   * Update user name in memory
   */
  updateUserName(name: string): void {
    console.log('\n📝 ========== UPDATING USER NAME ==========');
    console.log('Old name:', this.userMemory?.user.name || '(empty)');
    console.log('New name:', name);

    if (this.userMemory) {
      this.userMemory.user.name = name;
      this.userMemory.last_updated = new Date().toISOString().split('T')[0];
      this.saveMemoryToLocalStorage();
      console.log('✅ User name updated successfully');
      console.log('📝 ========================================\n');
    } else {
      console.log('❌ No memory loaded, cannot update');
      console.log('📝 ========================================\n');
    }
  }

  /**
   * Update user notes in memory
   */
  updateUserNotes(notesText: string): void {
    console.log('\n📝 ========== UPDATING USER NOTES ==========');
    console.log('Old notes count:', this.userMemory?.user.notes.length || 0);

    if (this.userMemory) {
      // Convert textarea string into array of notes (split by newlines)
      const notes = notesText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      console.log('New notes count:', notes.length);
      console.log('New notes:');
      notes.forEach((note, i) => console.log(`  ${i + 1}. ${note}`));

      this.userMemory.user.notes = notes;
      this.userMemory.last_updated = new Date().toISOString().split('T')[0];
      this.saveMemoryToLocalStorage();
      console.log('✅ User notes updated successfully');
      console.log('📝 ========================================\n');
    } else {
      console.log('❌ No memory loaded, cannot update');
      console.log('📝 ========================================\n');
    }
  }

  /**
   * Save memory to localStorage (since we're client-side only)
   */
  private saveMemoryToLocalStorage(): void {
    if (this.userMemory) {
      const memoryString = JSON.stringify(this.userMemory, null, 2);
      localStorage.setItem('kuchi_memory', memoryString);
      console.log('💾 Memory saved to localStorage');
      console.log('💾 Memory size:', (memoryString.length / 1024).toFixed(2), 'KB');
    }
  }

  /**
   * Load memory from localStorage (fallback if fetch fails)
   */
  private loadMemoryFromLocalStorage(): UserMemory | null {
    try {
      const saved = localStorage.getItem('kuchi_memory');
      if (saved) {
        console.log('📦 Found memory in localStorage');
        console.log('📦 Size:', (saved.length / 1024).toFixed(2), 'KB');
        return JSON.parse(saved);
      } else {
        console.log('📦 No memory found in localStorage');
      }
    } catch (error) {
      console.error('❌ Failed to load memory from localStorage:', error);
    }
    return null;
  }

  /**
   * Reinitialize system prompt with updated memory context
   */
  refreshSystemPrompt(): void {
    if (this.conversationHistory.length > 0) {
      const memoryContext = this.buildMemoryContext();

      // Update the system message (first message)
      this.conversationHistory[0] = {
        role: 'system',
        content:
          'You are Kuchi, a friendly robot assistant with expressive animated faces. ' +
          'Keep responses conversational, warm, and concise since they will be spoken aloud. ' +
          'Use simple language and be helpful. When you need current information, use web search.\n\n' +
          memoryContext,
      };

      console.log('🔄 System prompt refreshed with updated memory');
    }
  }
}
