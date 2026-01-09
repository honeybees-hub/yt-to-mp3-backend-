const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');

const app = express();

// Enable CORS for ALL origins (wildcard) to prevent "Failed to fetch"
app.use(cors({
    origin: '*',
    methods: ['GET'],
    allowedHeaders: ['Content-Type']
}));

// Root Route for Health Check
app.get('/', (req, res) => {
    res.send('Backend is actively running! Use /api/download in your frontend.');
});

// Locate yt-dlp binary from youtube-dl-exec package
const isWin = process.platform === "win32";
const binName = isWin ? 'yt-dlp.exe' : 'yt-dlp';
const binPath = path.join(__dirname, 'node_modules', 'youtube-dl-exec', 'bin', binName);

app.get('/api/download', async (req, res) => {
    const videoURL = req.query.url;
    console.log(`Received request for: ${videoURL}`);

    if (!videoURL) {
        return res.status(400).send('YouTube URL is required');
    }

    try {
        // Step 1: Get Video Title (Metadata)
        // We spawn yt-dlp purely to get JSON metadata first
        const infoProc = spawn(binPath, ['--dump-single-json', '--no-warnings', videoURL]);

        let infoData = '';
        let infoError = '';

        infoProc.stdout.on('data', (chunk) => {
            infoData += chunk.toString();
        });

        infoProc.stderr.on('data', (chunk) => {
            infoError += chunk.toString();
        });

        await new Promise((resolve, reject) => {
            infoProc.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Metadata fetch failed: ${infoError}`));
            });
        });

        let title = 'audio';
        try {
            const info = JSON.parse(infoData);
            if (info.title) {
                // Sanitize title
                title = info.title.replace(/[^\w\s-]/gi, '');
            }
        } catch (e) {
            console.warn('Could not parse metadata, using default filename');
        }

        console.log(`Title: ${title}`);

        // Step 2: Stream Audio
        // We instruct yt-dlp to output to stdout ('-') which we pipe to response
        res.header('Content-Disposition', `attachment; filename="${title}.mp3"`);
        res.header('Content-Type', 'audio/mpeg');

        const streamProc = spawn(binPath, [
            '-f', 'bestaudio', // Best audio quality
            '-o', '-',         // Output to stdout
            '--no-warnings',
            videoURL
        ]);

        streamProc.stdout.pipe(res);

        streamProc.stderr.on('data', (data) => {
            // Logs from yt-dlp during streaming
            console.error(`yt-dlp stderr: ${data}`);
        });

        streamProc.on('close', (code) => {
            if (code !== 0) {
                console.error(`Stream process exited with code ${code}`);
            } else {
                console.log('Stream finished successfully');
            }
        });

    } catch (error) {
        console.error('Download Error:', error);
        if (!res.headersSent) {
            res.status(500).send('Server Error: ' + error.message);
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Using yt-dlp binary at: ${binPath}`);
});
