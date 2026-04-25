# Interactive Presentation App

![Hero Image](./public/hero.png)

> A lightweight, open-source web app that makes presentations and study sessions genuinely interactive for crowds of 10–100+ people.

## ✨ Features

- **Host Dashboard**: Full control over what the audience sees — polls, prompts, quizzes, and more.
- **Instant Join**: Audience members join via QR code or short code. No accounts, no downloads.
- **Real-time Sync**: Everything updates instantly across all devices using WebSockets (via PartyKit).
- **Multiple Modes**: 
  - **Crowd Prompt**: Send bold, full-screen cues to everyone.
  - **Live Polls**: Create on-the-fly polls with real-time bar charts.
  - **Quizzes**: Test knowledge with reveals for correct answers.
  - **Open Text**: Gather responses and stream them to the host screen.
  - **Reactions**: Let the audience shower the screen with emojis.
  - **Countdown**: Sync a big timer across all devices.
- **Slide Deck Engine**: Upload PDFs and sync slide transitions with interaction overlays.
- **Zero-Ops Deployment**: Works on Localhost (offline), Vercel, or via Docker.

## 🚀 Quick Start (Localhost)

Best for classrooms or events on the same Wi-Fi. No internet required after initial setup.

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Setup environment**:
   ```bash
   cp .env.example .env.local
   ```
3. **Run development server**:
   ```bash
   npm run dev
   ```
4. **Share**: Point your camera at the QR code shown on the host dashboard (accessible at `http://localhost:3000/host`).

## ☁️ Cloud Deployment (Vercel + PartyKit)

1. **Deploy Frontend**: Click the button below to deploy to Vercel.
   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FTroy-LL%2FPresentation)
2. **Deploy WebSocket Server**:
   ```bash
   npx partykit deploy
   ```
3. **Configure Environment**: Ensure `NEXT_PUBLIC_MODE` is set to `cloud`.

## 🐳 Self-Hosting (Docker)

Run the full stack with a single command:

```bash
docker-compose up -d
```

Access the host dashboard at `http://localhost:3000/host`.

## 🛠 Tech Stack

- **Frontend**: Next.js 15, Tailwind CSS, Framer Motion
- **Real-time**: PartyKit / PartySocket
- **PDF Engine**: PDF.js
- **Icons**: Lucide React

## 📖 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_MODE` | `local` or `cloud` | `local` |
| `NEXT_PUBLIC_APP_URL` | The public URL of the app | `http://localhost:3000` |
| `NEXT_PUBLIC_PARTYKIT_HOST` | WebSocket host address | `localhost:3001` |
| `PARTYKIT_SERVER_URL` | Internal URL for API-to-Party communication | `http://localhost:3001` |

## 🛠 Troubleshooting

### LAN Connection Issues
If audience phones cannot connect to your local machine:
- **Same Wi-Fi**: Ensure all devices are on the same local network.
- **Firewall**: Your host machine's firewall might be blocking port 3000 or 3001. Try temporarily disabling it or adding an exception.
- **IP Address**: The QR code uses the value of `NEXT_PUBLIC_APP_URL`. If you are on a LAN, this should be your local IP (e.g., `http://192.168.1.50:3000`).

### WebSocket Connection (PartyKit)
- **Local Mode**: Ensure the `party` service (port 3001) is running.
- **Cloud Mode**: Verify your `NEXT_PUBLIC_PARTYKIT_HOST` matches your deployed PartyKit project name.

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

This project is licensed under the [MIT License](LICENSE).
