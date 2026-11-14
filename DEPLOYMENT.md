# Deploy Still / Stories to Vercel

This is a static HTML/CSS/JavaScript site. All deployable files are already in `dist/`. The build command validates those files; it does not generate or delete the portfolio. There are no application dependencies, server functions, API keys, or required environment variables.

## Verify locally

From this project directory:

```powershell
npm.cmd run build
python -m http.server 4173 --directory dist
```

Open http://localhost:4173. Check the intro, gallery filters, Gallery/Index switch, image viewer, About tabs, mobile menu, and contact dialog. Stop the local server with Ctrl+C.

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
| Environment Variables | None required |

5. Choose **Deploy**. Open the deployment URL and repeat the interaction checks.

Do not set the Root Directory to `dist`: the configuration and validation script live one directory above it. The prior `.openai` configuration is unrelated to Vercel and is excluded from CLI uploads.

## Deploy using the CLI

Run from the same directory as `vercel.json`. Use your own Vercel account when the CLI requests authentication:

```powershell
cd C:\Users\USER\cinematic\still-stories
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
- The contact dialog currently previews a `mailto:` link for an address entered by the visitor. It is a demo, not a message submission service. Add your actual destination address or connect a form service before using the site to collect inquiries.
- Creator credits and Lottie licenses are included in `dist/assets/lottie/` and the footer; retain them when deploying.
- Typography loads from Google Fonts; photography, animation data, and playback runtimes are served locally.

The supplied `404.html` handles missing pages. Section navigation uses URL fragments such as `/#about`, so no SPA catch-all rewrite is needed. Unknown file paths should return 404 rather than homepage HTML.

## Updating the site

Edit the files in `dist/`, run `npm.cmd run build`, then push to your connected repository. Vercel's Git integration deploys the updated project. With CLI deployments, rerun the preview or production command.

Official references: [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json), [configuring a build](https://vercel.com/docs/builds/configure-a-build), [Vercel CLI](https://vercel.com/docs/cli).
