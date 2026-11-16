# Cloudflare Pages CI/CD

The `Cloudflare Pages` GitHub Actions workflow builds pull requests targeting
`dev` or `main`, builds pushes to both branches, and deploys pushes to `main`.
It can also be run manually on `main` to deploy production.

The existing Direct Upload project is `smart-locking-fe`, available at
[smart-locking-fe.pages.dev](https://smart-locking-fe.pages.dev). Its production branch is `main`, so the
deployment command explicitly uses `--branch=main`.

Configure these repository settings in GitHub Actions:

| Kind | Name | Value |
| --- | --- | --- |
| Secret | `CLOUDFLARE_API_TOKEN` | Cloudflare token with Account / Cloudflare Pages / Edit, scoped to the deployment account |
| Variable | `CLOUDFLARE_ACCOUNT_ID` | Account ID of the existing Pages project; confirm it with the deployment owner |
| Variable | `VITE_API_BASE_URL` | Confirmed public HTTPS backend base URL, without `/api` or `/hubs/operations` suffixes |

### API configuration and production guard

The [workflow](../.github/workflows/cloudflare-pages.yml) passes the GitHub
Actions repository variable `vars.VITE_API_BASE_URL` to the build. This is the
configuration source for CI; a developer's ignored `.env` or
`.env.production.local` file is not uploaded by checkout. Vite embeds this value
in the JavaScript bundle at build time. Changing a variable after a build does
not update that artifact: an authorized release must build a new artifact.
Values prefixed with `VITE_` are public browser configuration and must never
contain secrets.

For pushes/manual runs on `main` and pull requests targeting `main`, the workflow
validates the variable before building. It rejects missing/invalid URLs,
non-HTTPS URLs, and the loopback hostnames `localhost`, `127.0.0.1`, and `[::1]`.
`http://localhost:5005` therefore cannot be used for a production build. This
syntactic guard does not verify DNS, public reachability, CORS, API health, or
authentication; the deployment owner must supply and verify the actual backend
URL. No production API endpoint is prescribed by this guide.

Pull requests targeting `dev` and pushes to `dev` build and test without this
production guard and do not deploy Pages. A green dev build does not establish
that production API configuration is valid. A pull request targeting `main`
also never deploys; deployment is limited to non-PR runs on `main`.

### Local development

[`.env.example`](../.env.example) uses `http://localhost:5005` for a backend
running on the same computer as the browser. Copy it to an ignored `.env` file
for local development, adjusting the URL for your own backend when needed.
The [API configuration](../src/config/api.ts) also falls back to this URL when
`VITE_API_BASE_URL` is absent or empty. That fallback is a local convenience,
not evidence of a configured production backend. Local `npm run build` does
not execute the workflow's production validation step.

### Verification before and after an authorized release

- Confirm the Actions variable with the backend/deployment owner. API callers
  add their own `/api/...` paths, and [SignalR](../src/hooks/use-operations-realtime.ts)
  adds `/hubs/operations`, so the base URL must not include those suffixes.
- Configure the backend's CORS policy for the actual frontend origin, including
  `https://smart-locking-fe.pages.dev` when using that Pages origin.
- Before release, confirm the production validation and build jobs pass for the
  intended artifact. After an authorized deployment, inspect browser requests:
  they must target the intended HTTPS backend rather than loopback, avoid mixed
  content/CORS errors, and support login for the intended roles and the
  authenticated operations SignalR connection.
- Record actual results and configuration blockers separately. Build success
  alone does not verify the deployed API or realtime integration.
