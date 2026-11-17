#!/bin/bash
# Add LeadCaller proxy to nginx config (idempotent).
# proxy_buffering/proxy_cache OFF are required: the MCP endpoint
# (/leadcaller/api/mcp) is an SSE stream, and nginx buffering silently
# swallows the endpoint event so MCP clients hang. (Found v0.67.6 -
# direct-to-app SSE worked, through-domain timed out.)
NGINX_CONF=/etc/nginx/sites-available/excellegacyrealtygroup.site

if grep -q "location /leadcaller" "$NGINX_CONF"; then
    # Ensure buffering is off even on pre-existing blocks
    if grep -A3 "location /leadcaller" "$NGINX_CONF" | grep -q "proxy_buffering off"; then
        echo "LeadCaller nginx location already exists (buffering off)"
    else
        sed -i '/location \/leadcaller {/a\        proxy_buffering off;\n        proxy_cache off;' "$NGINX_CONF"
        echo "LeadCaller nginx location patched (buffering off)"
    fi
else
    sed -i '/location \/ {/i\
    location /leadcaller {\
        proxy_buffering off;\
        proxy_cache off;\
        proxy_pass http://127.0.0.1:3219;\
        proxy_http_version 1.1;\
        proxy_set_header Upgrade $http_upgrade;\
        proxy_set_header Connection "upgrade";\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
        proxy_read_timeout 86400;\
    }\
' "$NGINX_CONF"
    echo "LeadCaller nginx location added"
fi

nginx -t 2>&1 | tail -2 && systemctl reload nginx
echo "Nginx reloaded"
