const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 5000;
const ffmpegPath = require('ffmpeg-static');

app.use(cors());
app.use(express.json());

const ytdl = require('yt-dlp-exec');

app.get('/api/download', async (req, res) => {
    const { url, format } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        console.log(`[BACKEND] Request received for: ${url} (Format: ${format})`);

        // Using yt-dlp-exec to stream stdout
        const stream = ytdl.exec(url, {
            extractAudio: true,
            audioFormat: format || 'mp3',
            audioQuality: '5', // Lower quality for faster processing to avoid Vercel timeouts
            output: '-',
            ffmpegLocation: ffmpegPath,
            noCheckCertificates: true,
            noPlaylist: true,
            // Use a very common browser-like User-Agent
            addHeader: [
                'User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept-Language:en-US,en;q=0.9'
            ],
            // Add some aggressive flags to bypass blocks
            geoBypass: true,
        }, { stdio: ['ignore', 'pipe', 'pipe'] });

        let headersSent = false;
        let errorOutput = '';

        stream.stdout.on('data', (chunk) => {
            if (!headersSent) {
                console.log('[BACKEND] Received first data chunk, sending response headers');
                res.header('Content-Disposition', `attachment; filename="audio.${format || 'mp3'}"`);
                res.header('Content-Type', format === 'm4a' ? 'audio/mp4' : 'audio/mpeg');
                headersSent = true;
            }
            res.write(chunk);
        });

        stream.stderr.on('data', (data) => {
            const msg = data.toString();
            errorOutput += msg;
            console.error(`[yt-dlp stderr] ${msg}`);
        });

        stream.on('close', (code) => {
            console.log(`[BACKEND] yt-dlp closed with code ${code}`);
            if (headersSent) {
                res.end();
            } else if (!res.headersSent) {
                // If we didn't send headers, it failed. Try to show the real error.
                let friendlyError = 'Failed to extract audio.';
                if (errorOutput.includes('403')) friendlyError += ' YouTube blocked the request (403 Forbidden).';
                else if (errorOutput.includes('Sign in')) friendlyError += ' This video is age-restricted or requires login.';
                else if (errorOutput.includes('not available')) friendlyError += ' Video is not available in the server\'s region.';

                res.status(500).json({
                    error: friendlyError,
                    details: errorOutput.substring(0, 200) // Send a bit of the log back
                });
            }
        });

        stream.on('error', (err) => {
            console.error('[BACKEND] Stream error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Internal streaming error' });
            }
        });

    } catch (error) {
        console.error('[BACKEND] Global Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Request initialization failed' });
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
