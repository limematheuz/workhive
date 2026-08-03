from pathlib import Path


security_directory = Path(__file__).parent
caddyfile = (security_directory / "Caddyfile.alb").read_text(encoding="utf-8")
compose_override = (security_directory / "docker-compose.alb.yml").read_text(
    encoding="utf-8"
)

assert ":80 {" in caddyfile
assert "trusted_proxies static private_ranges" in caddyfile
assert "trusted_proxies_strict" in caddyfile
assert "handle /health*" in caddyfile
assert "@app_host host {$APP_DOMAIN}" in caddyfile
assert "max_size 6MB" in caddyfile
assert caddyfile.count("header_up X-Forwarded-Proto https") == 4
assert "./ops/security/Caddyfile.alb:/etc/caddy/Caddyfile:ro" in compose_override

print("ALB origin configuration contract passed")
