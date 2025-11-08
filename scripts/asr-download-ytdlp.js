#!/usr/bin/env node
// ASR Audio Download Script with yt-dlp (recommended for reliability)
// Usage: node scripts/asr-download-ytdlp.js <youtube-url>

import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);

const url = process.argv[2];
if (!url) {
  console.error('Usage: node scripts/asr-download-ytdlp.js <youtube-url>');
  console.error('Example: node scripts/asr-download-ytdlp.js "https://youtu.be/7e00NogWdm4"');
  process.exit(2);
}

const outDir = path.resolve(__dirname, '..', 'asr-output');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Check if yt-dlp is available
function hasYtDlp() {
  try {
    execSync('yt-dlp --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Check if ffmpeg is available
function hasFfmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Main execution
async function main() {
  console.log('YouTube Audio Downloader for ASR (using yt-dlp)');
  console.log('=================================================\n');
  console.log('Target URL:', url);
  console.log('Output directory:', outDir, '\n');
  
  // Check for yt-dlp
  if (!hasYtDlp()) {
    console.error('✗ yt-dlp is not installed or not in PATH.\n');
    console.error('Installation options:');
    console.error('  1. Using pip:    pip install yt-dlp');
    console.error('  2. Using pipx:   pipx install yt-dlp');
    console.error('  3. Using winget: winget install yt-dlp');
    console.error('  4. Download:     https://github.com/yt-dlp/yt-dlp/releases\n');
    console.error('After installing, add yt-dlp to your PATH and try again.');
    process.exit(1);
  }
  
  const ffmpegAvail = hasFfmpeg();
  if (!ffmpegAvail) {
    console.warn('⚠ ffmpeg not found. Audio will be downloaded as best available format.');
    console.warn('  Install ffmpeg for WAV conversion: https://ffmpeg.org/download.html\n');
  }
  
  const outputTemplate = path.join(outDir, '%(title)s.%(ext)s');
  const extraArgs = ffmpegAvail 
    ? '--audio-format wav --audio-quality 0 --postprocessor-args "ffmpeg:-ac 1 -ar 16000"'
    : '--audio-format mp3';
  
  const cmd = `yt-dlp -x ${extraArgs} -o "${outputTemplate}" "${url}"`;
  
  console.log('Running yt-dlp...');
  console.log('Command:', cmd, '\n');
  
  try {
    const { stdout, stderr } = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 });
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    
    console.log('\n✓ Audio downloaded successfully to:', outDir);
    console.log('\nNext steps for transcription:');
    console.log('  1. Find the audio file in:', outDir);
    console.log('  2. Install Whisper: pip install openai-whisper');
    console.log('  3. Transcribe:');
    console.log('     whisper "asr-output/your-file.wav" --model base --language en');
    console.log('\nAlternatively, use cloud ASR services like:');
    console.log('  - Google Cloud Speech-to-Text');
    console.log('  - Azure Speech Service');
    console.log('  - AWS Transcribe');
    
  } catch (error) {
    console.error('\n✗ Download failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  1. Check if the URL is valid and accessible');
    console.error('  2. Some videos may have geographic or age restrictions');
    console.error('  3. Update yt-dlp: pip install -U yt-dlp');
    console.error('  4. Try with cookies: yt-dlp --cookies-from-browser chrome "URL"');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
