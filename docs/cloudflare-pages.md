# Cloudflare Pages CI/CD

The `Cloudflare Pages` GitHub Actions workflow builds pull requests targeting
`dev` or `main`, builds pushes to both branches, and deploys pushes to `main`.
It can also be run manually on `main` to deploy production.

The existing Direct Upload project is `smart-locking-fe`, available at
https://smart-locking-fe.pages.dev. Its production branch is `main`, so the
deployment command explicitly uses `--branch=main`.

Configure these repository settings in GitHub Actions:

| Kind | Name | Value |
| --- | --- | --- |
| Secret | `CLOUDFLARE_API_TOKEN` | Cloudflare token with Account / Cloudflare Pages / Edit, scoped to the deployment account |
| Variable | `CLOUDFLARE_ACCOUNT_ID` | `ad8e06ac22524cc79201f57cc20073dc` |
| Variable | `VITE_API_BASE_URL` | Temporarily `http://localhost:5005`; replace with the public HTTPS backend URL |

Vite embeds the API URL during build. After changing `VITE_API_BASE_URL`, run
the workflow again on `main`. Values prefixed with `VITE_` are public browser
configuration and must never contain secrets. `.env.production.local` only
affects local builds and is ignored by Git.

After deploying the backend, allow https://smart-locking-fe.pages.dev in its
CORS configuration and verify login and realtime connections.
