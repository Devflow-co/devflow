/**
 * Test Perplexity Best Practices via OpenRouter
 */

import axios from 'axios';

async function testPerplexity() {
  console.log('🧪 Testing Perplexity via OpenRouter\n');

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENROUTER_API_KEY not set');
    process.exit(1);
  }

  console.log('API Key:', apiKey.substring(0, 15) + '...');

  const query = `What are the best practices for: User Authentication with JWT

Language: TypeScript
Framework: NestJS

Task description: Implement secure login with email/password, JWT tokens, and rate limiting

Please provide:
1. Industry best practices for this type of task
2. Common pitfalls to avoid
3. Recommended patterns and approaches
4. Security considerations if applicable
5. Performance optimization tips`;

  console.log('\n📤 Sending request to Perplexity (sonar-pro)...\n');

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'perplexity/sonar-pro',
        messages: [{ role: 'user', content: query }],
        max_tokens: 2048,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://devflow.dev',
          'X-Title': 'DevFlow - Best Practices Test',
        },
      }
    );

    console.log('✅ Response received!\n');
    console.log('Model used:', response.data.model);
    console.log('Tokens:', response.data.usage);
    console.log('\n--- Best Practices ---\n');
    console.log(response.data.choices[0].message.content.substring(0, 1500) + '...\n');
  } catch (error: any) {
    console.error('❌ Error:', error.response?.data || error.message);

    if (error.response?.status === 404) {
      console.log('\n⚠️  Model perplexity/sonar-pro may not be available.');
      console.log('Trying alternative model: perplexity/sonar...\n');

      try {
        const response2 = await axios.post(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            model: 'perplexity/sonar',
            messages: [{ role: 'user', content: query }],
            max_tokens: 2048,
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://devflow.dev',
              'X-Title': 'DevFlow - Best Practices Test',
            },
          }
        );

        console.log('✅ Response received with perplexity/sonar!\n');
        console.log('Model used:', response2.data.model);
        console.log('\n--- Best Practices ---\n');
        console.log(response2.data.choices[0].message.content.substring(0, 1500) + '...\n');
      } catch (error2: any) {
        console.error('❌ Also failed with perplexity/sonar:', error2.response?.data || error2.message);
      }
    }
  }
}

testPerplexity();
