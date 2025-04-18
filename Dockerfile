FROM denoland/deno:2.2.6

WORKDIR /app

# Copy source code
COPY . .

# Set DNS options for better network connectivity
# This helps with DNS resolution issues in some environments
ENV DENO_DNS_RESOLVER="https://1.1.1.1/dns-query,https://8.8.8.8/dns-query"

# Expose the port the app runs on
EXPOSE 3000

# Grant permissions for network and environment variables
CMD ["run", "--allow-net", "--allow-env", "main.ts"]
