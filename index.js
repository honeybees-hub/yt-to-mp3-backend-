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
        console.log(`Starting download for: ${url} in format: ${format}`);

        // Set headers for download
        res.header('Content-Disposition', `attachment; filename="audio.${format || 'mp3'}"`);
        res.header('Content-Type', format === 'm4a' ? 'audio/mp4' : 'audio/mpeg');

        // Using yt-dlp-exec to stream stdout
        const stream = ytdl.exec(url, {
            extractAudio: true,
            audioFormat: format || 'mp3',
            audioQuality: '0',
            output: '-',
            ffmpegLocation: ffmpegPath
        }, { stdio: ['ignore', 'pipe', 'pipe'] });

        stream.stdout.pipe(res);

        stream.stderr.on('data', (data) => {
            console.error(`yt-dlp-exec stderr: ${data}`);
        });

        stream.on('close', (code) => {
            if (code !== 0) {
                console.error(`yt-dlp process exited with code ${code}`);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Failed to download audio' });
                }
            }
            console.log('Download process completed');
        });

        stream.on('error', (err) => {
            console.error('Failed to start yt-dlp process:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'yt-dlp not found or failed to start. Please ensure yt-dlp is installed.' });
            }
        });

    } catch (error) {
        console.error('Error during download:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
