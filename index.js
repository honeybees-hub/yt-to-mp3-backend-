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

        // Set headers for download
        res.header('Content-Disposition', `attachment; filename="audio.${format || 'mp3'}"`);
        res.header('Content-Type', format === 'm4a' ? 'audio/mp4' : 'audio/mpeg');

        let dataReceived = false;

        // Using yt-dlp-exec to stream stdout
        const stream = ytdl.exec(url, {
            extractAudio: true,
            audioFormat: format || 'mp3',
            audioQuality: '0',
            output: '-',
            ffmpegLocation: ffmpegPath,
            noCheckCertificates: true,
            noWarnings: true,
            addHeader: [
                'User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ]
        }, { stdio: ['ignore', 'pipe', 'pipe'] });

        stream.stdout.on('data', (chunk) => {
            if (!dataReceived) {
                console.log('[BACKEND] First data chunk received from yt-dlp');
                dataReceived = true;
            }
            res.write(chunk);
        });

        stream.stderr.on('data', (data) => {
            const msg = data.toString();
            console.error(`[yt-dlp stderr] ${msg}`);
        });

        stream.on('close', (code) => {
            console.log(`[BACKEND] yt-dlp process closed with code ${code}`);
            if (code !== 0 && !dataReceived) {
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Extraction failed. Check logs.' });
                } else {
                    res.end();
                }
            } else {
                res.end();
            }
        });

        stream.on('error', (err) => {
            console.error('[BACKEND] Subprocess error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Process execution error' });
            }
        });

    } catch (error) {
        console.error('[BACKEND] Global catch error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
