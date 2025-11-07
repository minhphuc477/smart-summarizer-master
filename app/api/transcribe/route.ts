import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { createRequestLogger } from '@/lib/logger';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  const startTime = Date.now();
  const logger = createRequestLogger(req);
  
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      logger.warn('No audio file uploaded');
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
    }

    logger.info('Starting audio transcription', undefined, { 
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });

    const transcriptionStart = Date.now();
    const transcription = await groq.audio.transcriptions.create({
      file: file,
      model: 'whisper-large-v3',
    });
    const transcriptionDuration = Date.now() - transcriptionStart;

    const totalDuration = Date.now() - startTime;
    logger.info('Transcription completed', undefined, {
      transcriptionDuration,
      textLength: transcription.text.length,
      totalDuration
    });
    
    logger.logResponse('POST', '/api/transcribe', 200, totalDuration);

    return NextResponse.json({ text: transcription.text });
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    logger.error('Error transcribing audio', error as Error);
    logger.logResponse('POST', '/api/transcribe', 500, totalDuration);
    
    return NextResponse.json({ error: 'Failed to transcribe audio.' }, { status: 500 });
  }
}