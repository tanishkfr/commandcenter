# Deploying Creative Memory Studio on Vercel

The hosted product uses a Vercel Function for the API and a private Vercel Blob store for durable personal memory. Local development continues to use `.memory/studio.json`.

## One-time Vercel setup

1. Import this repository into Vercel and keep the detected **Vite** framework settings.
2. In the project dashboard, open **Storage**, create a **Blob** store, choose **Private**, and connect it to this project.
3. Add these environment variables for Production and Preview:

   - `NVIDIA_API_KEY` — optional; Studio still works in local-intelligence mode without it.
   - `NVIDIA_MODEL` — optional; defaults to `meta/llama-3.3-70b-instruct`.
   - `API_KEY` — a long random bearer token protecting the stateless `/api/mcp` endpoint.
   - `PUBLIC_APP_URL` — the public `https://...` URL of this deployment.

4. Redeploy after connecting Blob or changing environment variables.
5. If visitors should open the app without signing into Vercel, disable Deployment Protection for the intended environment in **Settings → Deployment Protection**.

Vercel injects the Blob credentials when the store is connected. Do not commit those credentials or your NVIDIA key.

## Verify the deployment

Open `/api/health` on the deployed URL. A healthy deployment returns JSON similar to:

```json
{"ok":true,"runtime":"vercel","storage":"vercel-blob"}
```

Then open the root URL. If Blob is not connected, Studio shows a repair checklist instead of a blank error screen.

## Local development

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:3000`. Local data remains in the ignored `.memory/studio.json` file.
