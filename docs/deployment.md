# Deploy Evayoung Photography to Vercel

The public photography site is static and served from `dist/`; the private photographer workspace adds Vercel Node API functions in `api/` and uses Supabase for authentication, database, and private photo storage. The build validates the public site and workspace assets. No npm dependencies are required. The workspace needs server-side Supabase environment variables before it can be used; see [Private client workspace](./private-workspace.md) for setup.

## Verify locally

From this project directory:

```powershell
npm.cmd run build
python -m http.server 4173 --directory dist
```

Open http://localhost:4173. Check the intro, gallery filters, Gallery/Index switch, image viewer, About tabs, mobile menu, and contact dialog. This static server cannot run `/api/*`; use `vercel dev` with Supabase environment variables to test workspace flows locally. Stop the local server with Ctrl+C.

## Booking and enquiry submissions

The booking form submits to **FormSubmit** at the recipient address configured in the form markup in `dist/index.html` and `dist/pages.js`. FormSubmit sends the submission to the configured inbox and retains submissions for up to 30 days. The form collects a name, reply email, photography type, and message; phone, preferred date, and location are optional.

On the first real submission, FormSubmit may send an activation email to the recipient. Open that message and confirm the form before expecting enquiries to be delivered. Form submissions can be tested locally, but use a real submission only when you are ready to activate the inbox. The forms use FormSubmit's AJAX endpoint for an in-page success or error state, with a normal POST fallback when JavaScript is unavailable.

## Deploy from Git

1. Put this project in your own GitHub, GitLab, or Bitbucket repository and push the latest files.
2. In Vercel, choose **Add New → Project**, then import that repository.
3. Select the directory containing `vercel.json` as the Root Directory:
   - If the repository contains `still-stories/`, choose `still-stories`.
   - If this project's contents are at the repository root, use `.`.
4. Use these settings. The included `vercel.json` supplies them automatically:

| Setting | Value |
| --- | --- |
| Framework Preset | Other |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | Empty / skip |
| Environment Variables | Required for workspace; see `private-workspace.md` |

5. Add the Supabase workspace variables to the Vercel project before testing the private workspace. Choose **Deploy** only when ready. Open the deployment URL and repeat the interaction checks.

Do not set the Root Directory to `dist`: the configuration and validation script live one directory above it. The prior `.openai` configuration is unrelated to Vercel and is excluded from CLI uploads.

## Deploy using the CLI

Run these commands from the project root (the directory containing `vercel.json`). Use your own Vercel account when the CLI requests authentication:

```powershell
npx.cmd vercel@latest
```

This creates a preview deployment. After reviewing it, deploy production:

```powershell
npx.cmd vercel@latest --prod
```

macOS/Linux users can use `npx` instead of `npx.cmd`. The first run may ask you to link or create a Vercel project. `.vercel/` contains the local project link and is ignored by Git.

## Content to personalize

- Replace the eight sample photographs in `dist/assets/` and update their descriptions in `dist/app.js`.
- Replace the concept branding and About copy in `dist/index.html`.
- Update the FormSubmit recipient in both `dist/index.html` and `dist/pages.js` if the booking inbox changes.
- Creator credits and Lottie licenses are included in `dist/assets/lottie/` and the footer; retain them when deploying.
- Typography loads from Google Fonts; photography, animation data, and playback runtimes are served locally.

The supplied `404.html` handles missing pages. Section navigation uses URL fragments such as `/#about`, so no SPA catch-all rewrite is needed. Unknown file paths should return 404 rather than homepage HTML.

The private owner workspace is at `/workspace`. Client links use `/collection/<unguessable-token>` and are rewritten to the password-protected gallery. These routes send `noindex`, `no-store`, and restrictive content-security headers. Keep the project root (including `api/`, `supabase/`, and `vercel.json`) in the Vercel deployment; do not deploy `dist/` as the project root.

## Updating the site

Edit the files in `dist/`, run `npm.cmd run build` and `npm.cmd test`, then push to your connected repository. Vercel's Git integration deploys the updated project. With CLI deployments, rerun the preview or production command.

Official references: [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json), [configuring a build](https://vercel.com/docs/builds/configure-a-build), [Vercel CLI](https://vercel.com/docs/cli).
