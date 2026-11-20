# Project documentation

Use the guides below to configure, test, and operate Evayoung Photography.

## Guides

- [Deployment](deployment.md) — local preview, booking-form activation, and Vercel deployment.
- [Private client workspace](private-workspace.md) — Supabase setup, owner access, client collections, and verification.

## Before launch

1. Run `npm.cmd run build` and `npm.cmd test` from the repository root.
2. Apply the workspace migration and configure the required Vercel environment variables as described in the workspace guide.
3. Verify the private flows on a Vercel Preview deployment before using Production.
4. Confirm the FormSubmit recipient and complete its activation email before expecting enquiries.
