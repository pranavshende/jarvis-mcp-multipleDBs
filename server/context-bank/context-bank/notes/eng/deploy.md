# Deploy

- seller-site & wms: merge to main → GitHub Actions → ECS. Arjun approves.
- portal: Vercel preview per PR, promote to prod manually (Felix or Arjun).
- ops-scripts: git pull on the box. Cron picks it up.
- jarvis: `ssh jarvis-hetzner && cd jarvis && git pull && systemctl restart jarvis`.
