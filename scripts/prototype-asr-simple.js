// Simple ASR prototype: stream audio with ytdl-core and optionally convert to WAV using ffmpeg
// Usage: node scripts/prototype-asr-simple.js <youtube-url>
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const ytdl = require('ytdl-core');

async function run() {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: node scripts/prototype-asr-simple.js <youtube-url>');
    process.exit(2);
  }
  const outDir = path.resolve(__dirname, '..', 'asr-output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const mp3Path = path.join(outDir, `audio-${Date.now()}.mp3`);

  try {
    console.log('Starting audio download to', mp3Path);
    const stream = ytdl(url, { quality: 'highestaudio' });
    const w = fs.createWriteStream(mp3Path);
    stream.pipe(w);
    await new Promise((resolve, reject) => {
      stream.on('error', reject);
      w.on('finish', resolve);
      w.on('error', reject);
    });
    console.log('Downloaded audio to', mp3Path);

    // Check for ffmpeg
    try {
      child_process.execSync('ffmpeg -version', { stdio: 'ignore' });
    } catch (e) {
      console.log('ffmpeg not available; MP3 saved at', mp3Path);
      process.exit(0);
    }

    const wavPath = mp3Path.replace(/\.mp3$/, '.wav');
    console.log('Converting to WAV at', wavPath);
    child_process.execSync(`ffmpeg -y -i "${mp3Path}" -ac 1 -ar 16000 -vn "${wavPath}"`, { stdio: 'inherit' });
    console.log('WAV created at', wavPath);
  } catch (err) {
    console.error('prototype-asr-simple error:', err && err.message ? err.message : err);
    process.exit(1);
  }
}

run();