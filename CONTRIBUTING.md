# Contributing to Interactive Presentation App

First off, thank you for considering contributing to this project! It's people like you who make the open-source community such an amazing place to learn, inspire, and create.

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/) (v10 or higher)

### Setup
1. **Fork the repository** on GitHub.
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Presentation.git
   cd Presentation
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Environment Variables**:
   Copy `.env.example` to `.env.local` in the root:
   ```bash
   cp .env.example .env.local
   ```
   Fill in the required variables (see the README for details).

5. **Run the development server**:
   ```bash
   npm run dev
   ```
   This will start both the Next.js frontend and the PartyKit local server.

## 🛠 Development Workflow

### Branching
- Create a new branch for your feature or bugfix: `git checkout -b feature/your-feature-name` or `fix/your-bug-name`.
- Keep your changes focused. If you're fixing two unrelated things, use two branches.

### Code Style
- We use **Prettier** for formatting and **ESLint** for linting.
- Most editors will handle this automatically, but you can run it manually:
  ```bash
   npm run lint
  ```

### Testing
- We use **Vitest** for unit testing.
- Run tests with:
  ```bash
  npm run test
  ```

### Pull Requests
1. **Push your changes** to your fork.
2. **Submit a Pull Request** (PR) to the `main` branch of the original repository.
3. **Describe your changes**: What does this PR do? Why is it necessary?
4. **Wait for review**: We'll get back to you as soon as possible!

## 🤝 Community
- Report bugs via [GitHub Issues](https://github.com/Troy-LL/Presentation/issues).
- Suggest features via [GitHub Discussions](https://github.com/Troy-LL/Presentation/discussions).

## 📄 License
By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
