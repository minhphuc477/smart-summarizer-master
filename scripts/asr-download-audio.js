#!/usr/bin/env node
// ASR Audio Download Script
// Downloads YouTube audio using yt-dlp (recommended) or ytdl-core (fallback)
// Usage: node scripts/asr-download-audio.js <youtube-url>

import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const url = process.argv[2];
if (!url) {
  console.error('Usage: node scripts/asr-download-audio.js <youtube-url>');
  process.exit(2);
}

const outDir = path.resolve(__dirname, '..', 'asr-output');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Check if yt-dlp is available
async function hasYtDlp() {
  try {
    execSync('yt-dlp --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Check if ffmpeg is available
async function hasFfmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Download using yt-dlp (most reliable)
async function downloadWithYtDlp(url, outDir) {
  console.log('Using yt-dlp to download audio...');
  const outputTemplate = path.join(outDir, '%(title)s.%(ext)s');
  
  try {
    // Download as WAV directly if ffmpeg is available
    const ffmpegAvail = await hasFfmpeg();
    const extraArgs = ffmpegAvail ? '--audio-format wav --audio-quality 0' : '--audio-format mp3';
    
    const cmd = `yt-dlp -x ${extraArgs} -o "${outputTemplate}" "${url}"`;
    console.log('Running:', cmd);
    
    const { stdout, stderr } = await execAsync(cmd);
    console.log(stdout);
    if (stderr) console.error(stderr);
    
    console.log('\n✓ Audio downloaded successfully to', outDir);
    console.log('\nNext steps:');
    console.log('1. Find the audio file in:', outDir);
    console.log('2. Use Whisper or another ASR engine to transcribe:');
    console.log('   whisper "path/to/audio.wav" --model base --language en');
    return true;
  } catch (error) {
    console.error('yt-dlp download failed:', error.message);
    return false;
  }
}

// Download using ytdl-core (fallback, less reliable)
async function downloadWithYtdlCore(url, outDir) {
  console.log('Attempting to use ytdl-core as fallback...');
  
  try {
    const ytdl = (await import('ytdl-core')).default;
    const info = await ytdl.getInfo(url);
    const title = info.videoDetails.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 120);
    const audioPath = path.join(outDir, `${title}.mp3`);
    
    console.log('Downloading audio to:', audioPath);
    
    const stream = ytdl(url, { quality: 'highestaudio' });
    const writeStream = fs.createWriteStream(audioPath);
    stream.pipe(writeStream);
    
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
      stream.on('error', reject);
    });
    
    console.log('✓ Downloaded MP3:', audioPath);
    
    // Try to convert to WAV if ffmpeg is available
    const ffmpegAvail = await hasFfmpeg();
    if (ffmpegAvail) {
      const wavPath = audioPath.replace(/\.mp3$/, '.wav');
      console.log('Converting to WAV...');
      execSync(`ffmpeg -y -i "${audioPath}" -ac 1 -ar 16000 -vn "${wavPath}"`, { stdio: 'inherit' });
      console.log('✓ Converted to WAV:', wavPath);
    } else {
      console.log('\nNote: ffmpeg not found. Install ffmpeg to convert to WAV.');
      console.log('Download ffmpeg: https://ffmpeg.org/download.html');
    }
    
    console.log('\nNext steps:');
    console.log('1. Use Whisper or another ASR engine to transcribe the audio');
    console.log('2. Example: whisper "' + (ffmpegAvail ? audioPath.replace(/\.mp3$/, '.wav') : audioPath) + '" --model base');
    return true;
  } catch (error) {
    console.error('ytdl-core download failed:', error.message);
    console.error('\nThis video may be protected or have special restrictions.');
    console.error('Recommendation: Install yt-dlp for better compatibility.');
    console.error('  pip install yt-dlp');
    console.error('  or download from: https://github.com/yt-dlp/yt-dlp/releases');
    return false;
  }
}

// Main execution
async function main() {
  console.log('YouTube Audio Downloader for ASR');
  console.log('=================================\n');
  console.log('Target URL:', url);
  console.log('Output directory:', outDir, '\n');
  
  const ytDlpAvailable = await hasYtDlp();
  
  if (ytDlpAvailable) {
    const success = await downloadWithYtDlp(url, outDir);
    if (success) return;
  } else {
    console.log('yt-dlp not found. Trying ytdl-core as fallback...');
    console.log('(For best results, install yt-dlp: pip install yt-dlp)\n');
  }
  
  const success = await downloadWithYtdlCore(url, outDir);
  if (!success) {
    console.error('\n✗ All download methods failed.');
    console.error('\nRecommendation:');
    console.error('1. Install yt-dlp: pip install yt-dlp');
    console.error('2. Install ffmpeg: https://ffmpeg.org/download.html');
    console.error('3. Try again with: node scripts/asr-download-audio.js "' + url + '"');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
