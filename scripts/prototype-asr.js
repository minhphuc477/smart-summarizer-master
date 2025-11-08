// Prototype ASR helper: download YouTube audio and extract a WAV for later transcription.
// Usage: node scripts/prototype-asr.js <youtube-url>
// Requirements: node, npm deps (ytdl-core), ffmpeg available on PATH

import fs from 'fs';
import path from 'path';
import child_process from 'child_process';
import ytdl from 'ytdl-core';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: node scripts/prototype-asr.js <youtube-url>');
    process.exit(2);
  }

  const outDir = path.resolve(__dirname, '..', 'asr-output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  try {
    console.log('Fetching video info...');
    const info = await ytdl.getInfo(url);
    const title = info.videoDetails.title.replace(/[\\/:*?"<>|]/g, '').slice(0, 120);
    const audioPath = path.join(outDir, `${title}.mp3`);
    const wavPath = path.join(outDir, `${title}.wav`);

    console.log('Downloading audio to', audioPath);
    const audioStream = ytdl(url, { quality: 'highestaudio' });
    const writeStream = fs.createWriteStream(audioPath);
    audioStream.pipe(writeStream);

    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
      audioStream.on('error', reject);
    });

    console.log('Download finished. Checking for ffmpeg...');
    try {
      child_process.execSync('ffmpeg -version', { stdio: 'ignore' });
    } catch (e) {
      console.error('\nffmpeg not found on PATH. To extract WAV, install ffmpeg and ensure it\'s on your PATH.');
      console.error('On Windows you can download from https://ffmpeg.org/download.html and add to PATH.');
      console.error('The downloaded MP3 is available at:', audioPath);
      process.exit(0);
    }

    console.log('Converting to WAV (16kHz mono) at', wavPath);
    // Convert to 16k mono WAV which is often acceptable for ASR
    const cmd = `ffmpeg -y -i "${audioPath}" -ac 1 -ar 16000 -vn "${wavPath}"`;
    child_process.execSync(cmd, { stdio: 'inherit' });

    console.log('WAV file created at', wavPath);
    console.log('\nNext steps: run your ASR engine on the WAV file (Whisper, cloud ASR, etc.).');

  } catch (err) {
    console.error('Error in prototype-asr:', err && err.message ? err.message : err);
    process.exit(1);
  }
}

run();