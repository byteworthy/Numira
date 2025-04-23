# Prisma Setup for Replit Environment

This document explains how to set up Prisma to work correctly in the Replit environment, addressing common issues with OpenSSL dependencies.

## Problem

When running Prisma in the Replit environment, you might encounter the following error:

```
Unable to require(`/home/runner/workspace/Numira/node_modules/.prisma/client/libquery_engine-debian-openssl-1.1.x.so.node`).
Prisma cannot find the required `libssl` system library in your system. Please install openssl-1.1.x and try again.

Details: libssl.so.1.1: cannot open shared object file: No such file or directory
```

This occurs because Prisma's query engine requires OpenSSL 1.1.x, which is not installed by default in the Replit environment.

## Solution

We've implemented two changes to address this issue:

### 1. Install OpenSSL 1.1.x in the setup script

The `setup.sh` script has been modified to install OpenSSL 1.1.x before running Prisma operations:

```bash
# Install OpenSSL 1.1 for Prisma
echo "📦 Installing OpenSSL 1.1 for Prisma..."
# For Replit environment
if command -v replit-install &> /dev/null; then
  replit-install openssl1.1
elif command -v apt-get &> /dev/null; then
  # For Debian/Ubuntu environments
  apt-get update && apt-get install -y openssl libssl1.1
elif command -v nix-env &> /dev/null; then
  # For Nix environments
  nix-env -i openssl_1_1
else
  echo "⚠️ Could not install OpenSSL 1.1. Attempting to continue anyway..."
fi
```

This script attempts to install OpenSSL 1.1.x using different package managers depending on the environment.

### 2. Specify binary targets in the Prisma schema

The `prisma/schema.prisma` file has been updated to specify binary targets that include the required OpenSSL versions:

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "debian-openssl-1.1.x", "linux-musl-openssl-3.0.x"]
}
```

This ensures that Prisma generates binaries compatible with different OpenSSL versions, increasing the chances of finding a compatible binary for the environment.

## Troubleshooting

If you still encounter issues with Prisma in the Replit environment:

1. Check if OpenSSL 1.1.x is installed:
   ```bash
   ldconfig -p | grep libssl
   ```

2. Try manually installing OpenSSL 1.1.x:
   ```bash
   # For Replit
   replit-install openssl1.1
   
   # For Debian/Ubuntu
   apt-get update && apt-get install -y openssl libssl1.1
   ```

3. Consider using a different database provider or ORM if the issue persists.

## References

- [Prisma Documentation on Binary Targets](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#binarytargets)
- [Prisma GitHub Issue on OpenSSL Compatibility](https://github.com/prisma/prisma/issues/10649)
