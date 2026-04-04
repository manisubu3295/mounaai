# Linux Server Deployment Guide

This guide explains how to deploy this project on a Linux server using Docker Compose.

The deployment layout in this repo is:

- `db` = PostgreSQL
- `redis` = Redis
- `api` = Node.js backend
- `web` = built React app served by Nginx inside the container
- `nginx` = edge reverse proxy exposing ports `80` and `443`

This is the simplest production path for this repo because the Compose files and Dockerfiles are already present.

## 1. Recommended server

Use one of these:

- Ubuntu 22.04 LTS
- Ubuntu 24.04 LTS
- Debian 12

Minimum practical server size:

- 2 vCPU
- 4 GB RAM
- 40 GB disk

You also need:

- a domain name pointing to the server public IP
- ports `80` and `443` open in the firewall
- SSH access as a sudo user

## 2. Install required packages

SSH into the server and run:

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg git ufw
```

Install Docker Engine and Docker Compose plugin:

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Optional but useful:

```bash
sudo usermod -aG docker $USER
newgrp docker
```

Verify:

```bash
docker --version
docker compose version
```

## 3. Open firewall ports

If `ufw` is enabled:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

## 4. Clone the project

Choose a deployment folder and clone the repository:

```bash
sudo mkdir -p /opt/pocketcomputer
sudo chown -R $USER:$USER /opt/pocketcomputer
cd /opt/pocketcomputer
git clone https://github.com/manisubu3295/mounaai.git .
```

## 5. Create the production environment file for Docker Compose

The production compose file is [infra/docker-compose.yml](infra/docker-compose.yml).

When you run `docker compose` from the `infra` folder, Compose will read variables from `infra/.env`.

Create that file:

```bash
cd /opt/pocketcomputer/infra
cat > .env <<'EOF'
JWT_SECRET=replace_with_a_long_random_secret
ENCRYPTION_KEY=replace_with_64_hex_chars
CORS_ORIGIN=https://your-domain.com
WHATSAPP_NUMBER=919000000000
WHATSAPP_MESSAGE=Hi, I am interested in Mouna AI Pro.
EOF
```

Generate a proper `ENCRYPTION_KEY` value:

```bash
openssl rand -hex 32
```

Generate a proper `JWT_SECRET` value:

```bash
openssl rand -hex 64
```

## 6. Decide whether you are deploying with HTTPS now or HTTP first

This step matters because the current Nginx config in [infra/nginx/conf.d/pocketcomputer.conf](infra/nginx/conf.d/pocketcomputer.conf) redirects all HTTP traffic to HTTPS by default.

You have two deployment modes:

### Option A: HTTPS now

Use this if you already have certificates or will place certificates before starting the stack.

You need these files:

- `infra/nginx/ssl/fullchain.pem`
- `infra/nginx/ssl/privkey.pem`

Then uncomment the HTTPS server block in [infra/nginx/conf.d/pocketcomputer.conf](infra/nginx/conf.d/pocketcomputer.conf) and replace `your-domain.com` with your real domain.

### Option B: HTTP first

Use this if you want the app running before configuring SSL.

Edit [infra/nginx/conf.d/pocketcomputer.conf](infra/nginx/conf.d/pocketcomputer.conf) like this:

1. Comment out the `HTTP -> HTTPS redirect` server block.
2. Uncomment the `HTTP-only` server block.
3. Replace `your-domain.com` with your real domain, or use `_` temporarily.

If you skip this change and do not have SSL configured, the site will redirect to HTTPS and appear broken.

## 7. Optional but important: pass email variables into the API container

The API expects values like these in [apps/api/.env.example](apps/api/.env.example):

- `RESEND_API_KEY`
- `EMAIL_FROM_ADDRESS`
- `APP_BASE_URL`
- `NOTIFICATION_EMAIL`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX`

The current production compose file only injects a subset of API environment variables.

If you want email notifications and full production behavior, update the `api.environment` section in [infra/docker-compose.yml](infra/docker-compose.yml) before deployment and add:

```yaml
      RESEND_API_KEY: ${RESEND_API_KEY}
      EMAIL_FROM_ADDRESS: ${EMAIL_FROM_ADDRESS}
      APP_BASE_URL: ${APP_BASE_URL}
      NOTIFICATION_EMAIL: ${NOTIFICATION_EMAIL:-}
      RATE_LIMIT_WINDOW_MS: ${RATE_LIMIT_WINDOW_MS:-60000}
      RATE_LIMIT_MAX: ${RATE_LIMIT_MAX:-100}
```

Then extend `infra/.env` with values such as:

```bash
RESEND_API_KEY=re_xxxxx
EMAIL_FROM_ADDRESS=Mouna AI <noreply@your-domain.com>
APP_BASE_URL=https://your-domain.com
NOTIFICATION_EMAIL=
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
```

If you do not need email immediately, you can skip this section and deploy first.

## 8. Build and start the stack

From the `infra` folder:

```bash
cd /opt/pocketcomputer/infra
docker compose up -d --build
```

This will:

- start PostgreSQL
- start Redis
- build the API image
- build the web image
- start Nginx

The API container runs Prisma migrations automatically on startup because its Dockerfile starts with:

```bash
npx prisma migrate deploy && node dist/server.js
```

## 9. Watch logs until services are healthy

Check the full stack:

```bash
docker compose ps
docker compose logs -f
```

Check specific services:

```bash
docker compose logs -f api
docker compose logs -f web
docker compose logs -f nginx
docker compose logs -f db
docker compose logs -f redis
```

You want to see:

- database healthy
- redis healthy
- API listening on port `4000`
- Nginx starting cleanly

## 10. Seed the LLM providers once

This project has a Prisma seed script in [apps/api/prisma/seed.ts](apps/api/prisma/seed.ts). Run it once after the database is ready:

```bash
cd /opt/pocketcomputer/infra
docker compose exec api sh -lc "npx prisma db seed"
```

This creates the default LLM provider entries such as Gemini and OpenAI.

## 11. Verify the deployment

Test the API health endpoint through Nginx:

```bash
curl -I http://your-domain.com/health
```

If HTTPS is enabled:

```bash
curl -I https://your-domain.com/health
```

Open the site in your browser:

- `http://your-domain.com` if you deployed in HTTP-only mode
- `https://your-domain.com` if you deployed with SSL

## 12. First application setup after the site opens

After the platform is reachable:

1. Sign up or log in with the first tenant admin account.
2. Configure the LLM provider in the app settings.
3. Add your Gemini or other provider API key.
4. Configure connectors if needed.
5. Configure communication email and notification settings if you use email alerts.

## 13. Optional: bootstrap demo data and rules

If you want the same demo-style setup used during development, you can run these scripts after the stack is up.

Run them from the API container only if the required dev tooling is available inside the container image:

```bash
cd /opt/pocketcomputer/infra
docker compose exec api sh -lc "pnpm exec tsx scripts/configure-sales-api.ts"
docker compose exec api sh -lc "pnpm exec tsx scripts/configure-sales-warehouse.ts"
docker compose exec api sh -lc "pnpm exec tsx scripts/configure-business-rules.ts"
```

If any of those commands fail because the runtime image does not expose the tooling you need, run them from a temporary admin shell on the server using the checked-out repo and Node.js, or skip them for production.

## 14. How to update the deployment later

When you push new code to GitHub, redeploy with:

```bash
cd /opt/pocketcomputer
git pull origin main
cd infra
docker compose up -d --build
```

Then verify:

```bash
docker compose ps
docker compose logs -f api
```

## 15. How to restart or stop the stack

Restart everything:

```bash
cd /opt/pocketcomputer/infra
docker compose restart
```

Restart only the API:

```bash
docker compose restart api
```

Stop everything:

```bash
docker compose down
```

Stop everything and remove volumes:

```bash
docker compose down -v
```

Do not use `down -v` unless you intentionally want to delete the PostgreSQL data volume.

## 16. Recommended SSL path with Let's Encrypt

If you want a proper public deployment:

1. Point your domain DNS to the server.
2. Start in HTTP-only mode first.
3. Obtain certificates with Certbot.
4. Place certificates in `infra/nginx/ssl/`.
5. Switch [infra/nginx/conf.d/pocketcomputer.conf](infra/nginx/conf.d/pocketcomputer.conf) to the HTTPS configuration.
6. Reload the stack.

Example Certbot install on Ubuntu:

```bash
sudo apt install -y certbot
```

After obtaining certs, copy or mount them as:

- `infra/nginx/ssl/fullchain.pem`
- `infra/nginx/ssl/privkey.pem`

## 17. Troubleshooting

### App redirects to HTTPS but HTTPS is not configured

Cause:

- the default Nginx config redirects HTTP to HTTPS

Fix:

- switch to the HTTP-only server block in [infra/nginx/conf.d/pocketcomputer.conf](infra/nginx/conf.d/pocketcomputer.conf)

### API container fails on startup

Check:

```bash
cd /opt/pocketcomputer/infra
docker compose logs -f api
```

Common causes:

- missing `JWT_SECRET`
- missing `ENCRYPTION_KEY`
- invalid database connection
- Prisma migration issue

### Nginx starts but site shows 502

Check:

```bash
docker compose logs -f nginx
docker compose logs -f web
docker compose logs -f api
```

This usually means the API or web container is not healthy yet.

### Email notifications do not work

Cause:

- email variables were not passed into the `api` container
- or the sender domain is not verified with Resend

Fix:

- add the email env vars described in Step 7
- verify the sender domain or use a valid Resend sender

### Database data must survive redeploys

This is already handled by the named Docker volume in [infra/docker-compose.yml](infra/docker-compose.yml):

- `pgdata`

As long as you do not run `docker compose down -v`, your PostgreSQL data stays intact.

## 18. Production checklist

Before going live, confirm all of these:

- domain DNS points to the server
- ports `80` and `443` are open
- `infra/.env` exists with strong secrets
- Nginx mode matches your SSL state
- API logs show successful startup
- database migrations completed
- LLM providers seeded
- app opens in the browser
- email env vars added if notifications are required
- SSL certificates installed if using HTTPS

## 19. One-command quick start summary

If you only want the shortest path, this is the sequence:

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg git ufw

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo mkdir -p /opt/pocketcomputer
sudo chown -R $USER:$USER /opt/pocketcomputer
cd /opt/pocketcomputer
git clone https://github.com/manisubu3295/mounaai.git .

cd infra
cat > .env <<'EOF'
JWT_SECRET=$(openssl rand -hex 64)
ENCRYPTION_KEY=$(openssl rand -hex 32)
CORS_ORIGIN=https://your-domain.com
WHATSAPP_NUMBER=919000000000
WHATSAPP_MESSAGE=Hi, I am interested in Mouna AI Pro.
EOF

docker compose up -d --build
docker compose exec api sh -lc "npx prisma db seed"
docker compose ps
docker compose logs -f api
```

Use the full guide above instead of this shortcut if you need SSL, email, or domain-specific Nginx changes.