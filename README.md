<div align="center">
  <img src="./public/hero.png" alt="Localhost Logo" width="800">

  # Interactive Presentation App
  
  **Presentations that breathe. Audience participation that actually works.**

  [![License: MIT](https://img.shields.io/badge/License-MIT-orange.svg)](https://opensource.org/licenses/MIT)
  [![Next.js 15](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
  [![PartyKit](https://img.shields.io/badge/Real--time-PartyKit-blueviolet)](https://www.partykit.io/)
  [![Docker Support](https://img.shields.io/badge/Docker-Ready-blue)](https://www.docker.com/)

  <p align="center">
    <a href="#🚀-quick-start">Quick Start</a> •
    <a href="#✨-key-features">Features</a> •
    <a href="#🛠-tech-stack">Tech Stack</a>
  </p>
</div>

---

## 💡 Why this exists?

Traditional presentations are a one-way street. Audience members sit in silence, and polling apps often require clunky downloads or paid accounts. 

This app is built for **zero friction**:
- **No Accounts**: Hosts and audience just show up and start.
- **No Downloads**: Everything runs in the browser.
- **Privacy First**: Fully self-hostable. Your data stays in your room.
- **Ultra Low Latency**: Real-time interactions synced in milliseconds.

---

## 📖 The Story

"I'm always at events, and I often find myself losing track of the presentation or not being able to see the slides clearly from the back. I kept thinking: *there has to be a better way to make this interactive.* 

There are tools out there, but they usually come with strings attached—they harvest your data, require annoying accounts, or just aren't the flexible 'Swiss Army Knife' I was looking for. So, I decided to build it myself. A tool that is fast, private, and focused entirely on the connection between the host and the audience." — *The Creator*

---

## ✨ Key Features

| Feature | Description |
| :--- | :--- |
| **🎨 Host Dashboard** | A powerful control center to launch interactions and monitor live results. |
| **📱 Instant Join** | One QR code scan. That's it. No sign-up, no "joining" screens. |
| **📊 Live Polls** | Create polls on the fly and watch results stream in with smooth animations. |
| **🎮 Interactive Slides** | Upload a PDF and overlay live prompts or emojis directly on your slides. |
| **🔥 Emoji Reactions** | Let the audience flood the screen with reactions during key moments. |
| **⏲️ Sync Timers** | Start a countdown that hits zero on every device at the exact same time. |
| **🔔 Attention Nudge** | Vibrate every phone in the room and show a custom alert to bring focus back to you. |

---

## 🚀 Quick Start (Localhost)

Best for classrooms, local meetups, or offline events. **No internet required** after dependencies are installed.

1. **Clone & Install**:
   ```bash
   git clone https://github.com/Troy-LL/Presentation.git
   cd Presentation
   npm install
   ```

2. **Environment Setup**:
   ```bash
   cp .env.example .env.local
   ```

3. **Launch**:
   ```bash
   npm run local
   ```
   *This will automatically detect your LAN IP and print the dashboard link for you.*

4. **Connect**: Follow the links printed in your terminal to see your dashboard and your room's QR code.

---

## 🛠 Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Real-time**: [PartyKit](https://www.partykit.io/) (Cloudflare Workers based)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **PDF Processing**: [PDF.js](https://mozilla.github.io/pdf.js/)
- **Icons**: [Lucide React](https://lucide.dev/)

---

## 📖 Environment Variables

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_MODE` | `local` | Set to `cloud` when deploying to production. |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | The public URL shown in QR codes. |
| `NEXT_PUBLIC_PARTYKIT_HOST` | `localhost:3001` | The WebSocket server address. |

---

## 🛠 Troubleshooting

<details>
<summary><b>My audience can't connect to my local IP</b></summary>
- Ensure all devices are on the <b>same Wi-Fi</b> network.
- Check that your `NEXT_PUBLIC_APP_URL` is set to your LAN IP (e.g., `http://192.168.1.50:3000`).
- Check your local firewall settings (allow ports 3000 and 3001).
</details>

<details>
<summary><b>PDF slides aren't loading correctly</b></summary>
- Large PDFs (>50MB) may take a moment to process.
- Ensure the PDF is not password protected.
</details>

---

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

Check out our [CONTRIBUTING.md](./CONTRIBUTING.md) to get started!

---

<div align="center">
  Built with ❤️ for better presentations. 
  <br>
  Released under the MIT License.
</div>
