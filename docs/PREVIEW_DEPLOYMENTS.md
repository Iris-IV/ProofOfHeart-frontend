# Preview Deployments

This document explains how per-PR preview deployments work for ProofOfHeart.

## Overview

Every pull request automatically gets an ephemeral preview deployment that allows reviewers to test changes before they reach production. Preview deployments:

- Use Stellar Testnet (not mainnet)
- Deploy to a unique URL per PR
- Are automatically torn down when the PR is merged or closed
- Are clearly labeled as non-production environments

## Configuration

### GitHub Secrets

Add these secrets to your repository settings:

1. `TESTNET_CONTRACT_ADDRESS` - Your deployed testnet contract address
2. Deployment platform credentials (e.g., `VERCEL_TOKEN`, `NETLIFY_AUTH_TOKEN`)

### Deployment Platform

The workflow file `.github/workflows/preview-deploy.yml` contains placeholder deployment logic. You need to integrate with your chosen platform:

#### Vercel

```yaml
- name: Deploy to Vercel
  id: deploy
  run: |
    npx vercel deploy --token=${{ secrets.VERCEL_TOKEN }} \
      --scope=${{ secrets.VERCEL_ORG_ID }} \
      --build-env NEXT_PUBLIC_USE_MOCKS=false \
      --build-env NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org \
      --build-env NEXT_PUBLIC_NETWORK_PASSPHRASE="Test SDF Network ; September 2015" \
      --build-env NEXT_PUBLIC_CONTRACT_ADDRESS=${{ secrets.TESTNET_CONTRACT_ADDRESS }} \
      > deployment-url.txt
    DEPLOYMENT_URL=$(cat deployment-url.txt)
    echo "deployment_url=$DEPLOYMENT_URL" >> $GITHUB_OUTPUT
```

#### Netlify

```yaml
- name: Deploy to Netlify
  id: deploy
  run: |
    npx netlify deploy --dir=.next \
      --auth=${{ secrets.NETLIFY_AUTH_TOKEN }} \
      --site=${{ secrets.NETLIFY_SITE_ID }} \
      --alias=pr-${{ github.event.pull_request.number }} \
      --json > deployment.json
    DEPLOYMENT_URL=$(jq -r '.deploy_url' deployment.json)
    echo "deployment_url=$DEPLOYMENT_URL" >> $GITHUB_OUTPUT
```

#### Other Platforms

Adapt the deployment step to your platform's CLI or API.

## Preview Environment Configuration

All preview deployments use the following configuration:

```bash
NEXT_PUBLIC_USE_MOCKS=false
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
NEXT_PUBLIC_CONTRACT_ADDRESS=<testnet-contract-address>
```

This ensures:

- Real contract interactions (mocks disabled)
- Testnet network (safe for testing)
- Explorer links point to testnet
- No risk to mainnet data

## Workflow

### When a PR is opened or updated:

1. GitHub Actions builds the application with testnet configuration
2. The build is deployed to a unique preview URL
3. A comment is posted on the PR with the preview URL
4. Reviewers can click through and test the changes

### When a PR is closed or merged:

1. The preview deployment is automatically torn down
2. A cleanup comment is posted on the PR
3. Resources are freed

## Security Considerations

- Preview deployments only work for PRs from the same repository (not forks)
- Testnet contract address is stored as a secret
- Preview URLs are ephemeral and should not be bookmarked
- No production data or mainnet credentials are used

## Testing Preview Deployments

To test a preview deployment:

1. Open a pull request
2. Wait for the preview deployment workflow to complete
3. Click the preview URL in the PR comment
4. Verify the banner indicates "Testnet" or "Preview"
5. Test your changes with a testnet wallet
6. Confirm explorer links point to testnet

## Troubleshooting

### Preview deployment fails

- Check GitHub Actions logs for build errors
- Verify all required secrets are set
- Ensure deployment platform credentials are valid

### Preview URL doesn't work

- Wait a few minutes for DNS propagation
- Check deployment platform dashboard
- Verify the deployment completed successfully

### Changes not reflected in preview

- Ensure the PR branch is up to date
- Check that the workflow ran after the latest push
- Clear browser cache and reload

## Cost Considerations

Preview deployments consume resources on your deployment platform. Consider:

- Setting up automatic cleanup for stale previews
- Limiting preview deployments to specific branches
- Using a free tier or development plan for previews
- Monitoring deployment costs

## Future Improvements

- Add visual indicators (banner) for preview environments
- Implement automatic E2E tests on preview deployments
- Add performance monitoring for preview builds
- Create preview-specific analytics tracking
