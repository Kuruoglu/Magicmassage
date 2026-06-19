# Remote Preview

Use this when the local development site must be visible from the internet for a client or for mobile testing outside the local network.

## Public internet link with Cloudflare Tunnel

1. Start the local Next.js server:

```bash
npm run dev
```

2. In a second terminal, start the public tunnel:

```bash
npm run share
```

3. Copy the generated `https://...trycloudflare.com` URL and send it to the client.

The public URL works only while both terminals are running. If the tunnel is restarted, the URL can change.

The first `npm run share` run downloads `cloudflared.exe` to the local user app data folder. The binary is not stored in the repository.

## Local Wi-Fi testing

If the phone is on the same Wi-Fi as the computer:

```bash
npm run dev:host
```

Then open:

```text
http://YOUR_PC_LOCAL_IP:3000
```

This option does not expose the site to the internet.
