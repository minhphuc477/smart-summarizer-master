import { NextRequest, NextResponse } from 'next/server';
import { createRequestLogger } from '@/lib/logger';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * POST /api/canvas/suggest
 * 
 * AI-powered suggestions for canvas nodes:
 * - Related concepts to expand on
 * - Suggested connections between nodes
 * - Node grouping recommendations
 */
export async function POST(request: NextRequest) {
  const logger = createRequestLogger(request);
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { nodes, edges, context } = body;

    if (!nodes || !Array.isArray(nodes)) {
      logger.logResponse('POST', '/api/canvas/suggest', 400, Date.now() - startTime);
      return NextResponse.json({ error: 'Invalid nodes data' }, { status: 400 });
    }

    // Extract node content
    const nodeContents = nodes.map((node: { data: { label: string }; id: string }) => ({
      id: node.id,
      content: node.data.label
    }));

    // Prepare prompt for AI
    const prompt = `You are a mind mapping and knowledge organization expert. Given these concepts from a canvas/mind map:

${nodeContents.map(n => `- ${n.content}`).join('\n')}

${context ? `Context: ${context}\n` : ''}

Please provide smart suggestions in JSON format with the following structure:
{
  "relatedConcepts": [
    {
      "title": "Concept name",
      "description": "Why this is related",
      "suggestedPosition": "near which existing node"
    }
  ],
  "suggestedConnections": [
    {
      "from": "node content A",
      "to": "node content B",
      "reason": "Why they should be connected",
      "label": "Optional edge label"
    }
  ],
  "groupings": [
    {
      "name": "Group name",
      "nodes": ["node content 1", "node content 2"],
      "reason": "Why they belong together"
    }
  ]
}

Provide 3-5 related concepts, 2-4 suggested connections, and 1-3 groupings.`;

    logger.info('Calling GROQ API for canvas suggestions', undefined, {
      nodeCount: nodes.length,
      edgeCount: edges?.length || 0
    });

    const aiStartTime = Date.now();
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a helpful AI assistant specializing in mind mapping, knowledge graphs, and creative thinking. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: 'json_object' }
    });

    const aiDuration = Date.now() - aiStartTime;

    const suggestions = JSON.parse(completion.choices[0]?.message?.content || '{}');

    logger.logResponse('POST', '/api/canvas/suggest', 200, Date.now() - startTime, {
      aiDuration,
      suggestionsCount: {
        concepts: suggestions.relatedConcepts?.length || 0,
        connections: suggestions.suggestedConnections?.length || 0,
        groupings: suggestions.groupings?.length || 0
      }
    });

    return NextResponse.json({
      success: true,
      suggestions
    });

  } catch (error) {
    logger.logResponse('POST', '/api/canvas/suggest', 500, Date.now() - startTime);
    console.error('Canvas suggestion error:', error);
    return NextResponse.json(
      { error: 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}
