# Contributing to Polyglot i+1

Thanks for your interest in improving Polyglot i+1! Contributions, bug reports,
feature suggestions, and ideas for improving the learning experience are welcome.

## Getting set up

```bash
git clone https://github.com/ludoviciphilip/Polyglot-AI.git
cd Polyglot-AI
npm install
```

You'll need a Google Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)
to exercise the AI story/audio generation features locally (set it in the app's Settings
screen after starting the dev server).

## Everyday commands

```bash
npm run dev      # Start the Vite development server
npm run build    # Production build
npm run preview  # Preview the production build
npm run lint     # TypeScript compiler checks (tsc)
npm run test     # Run the Vitest test suite
```

Please run `npm run lint` and `npm run test` before opening a pull request.

## Making a change

1. Fork the repository and create a feature branch off `main`.
2. Make your changes, keeping them focused and scoped.
3. Run the checks above and confirm the production build succeeds.
4. Open a pull request describing the change and why it's useful.

For substantial changes (new AI providers, data model changes, major UI rework),
please open an issue first to discuss the approach.

## Code style

The project uses TypeScript and React function components. Match the existing
patterns in `components/`, `services/`, and `utils/` rather than introducing new
conventions. Keep translations in `locales/` in sync when adding user-facing strings.
