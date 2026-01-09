FROM node:18-slim

# 1. Install Python3 and minimal dependencies
# yt-dlp requires python3 to function via youtube-dl-exec
RUN apt-get update && \
    apt-get install -y python3 python3-pip && \
    pip3 install yt-dlp --break-system-packages || pip3 install yt-dlp && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# 2. Create App Directory
WORKDIR /usr/src/app

# 3. Copy dependencies and install
COPY package*.json ./
RUN npm install

# 4. Copy Source Code
COPY . .

# 5. Expose Port
EXPOSE 3000

# 6. Start the server
CMD [ "npm", "start" ]
