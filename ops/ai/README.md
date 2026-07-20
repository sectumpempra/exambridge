# ExamBridge AI service handoff

This directory contains inactive deployment templates. Adding them to the repository does not enable or publish the assistant.

## Release boundary

- Build the server with `npm run build:ai` in the same verified source commit as the static site.
- Copy only `dist-ai/server.mjs`, `dist-ai/README.txt`, and `dist-ai/artifact-manifest.json` into a new immutable AI release directory.
- Before switching `current`, verify that the bundle hash in `artifact-manifest.json` matches `server.mjs`, and that its knowledge-manifest hash matches the active static release. This prevents an AI service from answering against a different data release.
- Keep `/etc/exambridge/ai.env` outside Git and outside every web root, owned by root with mode `0600`.
- Point `EXAMBRIDGE_PUBLIC_ROOT` at the currently active, already verified static release so the assistant reads the same active data that the pages display.
- Never copy `public/exam-materials`, source PDFs, candidate data, or a local `.env` into an AI release.

## Internal preview sequence

1. Create a versioned AI release directory and update `/var/www/exambridge-ai/current` atomically.
2. Install the service template only after replacing the service user and Node path with values verified on the server.
3. Start the service and verify `http://127.0.0.1:8789/api/ai/health` locally.
4. Add the Nginx locations, validate the Nginx configuration, and reload it.
5. Build the static preview with `VITE_AI_ASSISTANT_PUBLIC=true`; leave the normal production build at its safe default until public approval.
6. Test SSE generation, cancellation, rate limits, citations, AQA isolation, and rollback before enabling the public navigation entry.

The repository smoke command uses the same provider implementation and sends only a fictional `ZX-000` record:

```text
npm run smoke:ai:provider
```

It prints only the model, streaming status, token counts, and whether a provider request ID was present. It never prints the API key, prompt, or answer body.

Rollback switches the AI release symlink back and reloads/restarts the service. It does not modify the static release or the persistent official-PDF directory.
