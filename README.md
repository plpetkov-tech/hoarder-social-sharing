# Hoarder Social Sharing Webhook

A Deno-based webhook service that automatically shares bookmarks from Hoarder to social media platforms with beautifully formatted posts.

This project is made just to ease my life and share in my (very few) socials the articles and little pearls I come up across.  

## 🌟 Features

- Automatically monitors Hoarder bookmarks via webhooks
- Tracks the lifecycle of bookmarks (created → crawled → AI tagged)
- Requests AI-generated summaries when needed
- Shares bookmarks to social media platforms with rich formatting
- Currently supports:
  - Bluesky (with proper link facets and hashtag formatting)
  - LinkedIn
- Uses engaging, randomly selected phrases to make posts more attractive
- Cleans up AI-generated text patterns for cleaner posts
- Includes proper link formatting and title attribution
- Optimizes content for each platform's character limits and features

## 🚀 Getting Started

### Prerequisites

- [Deno](https://deno.land/)
- Hoarder API token
- Social media platform credentials (Bluesky, LinkedIn)

### Environment Variables

The application uses the following environment variables:

```
HOARDER_API_TOKEN - Your Hoarder API token
HOARDER_API_BASE_URL - Your Hoarder API base URL
BLUESKY_USERNAME - Your Bluesky username
BLUESKY_PASSWORD - Your Bluesky password
LINKEDIN_ACCESS_TOKEN - Your LinkedIn access token
LINKEDIN_USER_URN - Your LinkedIn user URN
PORT - The port to run the server on (default: 3000)
```

### Installation

1. Clone this repository
2. Configure your environment variables
3. Run the application with Deno locally or in Kubernetes

### Running the Application

To start the server:

```bash
deno task start
```

For development with hot reloading:

```bash
deno task dev
```

### Docker

The repository includes a Dockerfile for containerized deployment. To build and run:

```bash
docker build -t hoarder-social-sharing .
docker run -p 3000:3000 --env-file .env hoarder-social-sharing
```

## 🚢 Kubernetes Deployment

This application is designed to be deployed to Kubernetes. A deployment manifest (`deployment.yaml`) is included in the repository that creates the necessary resources:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    app: hoarder-social-sharing
  name: hoarder-social-sharing
spec:
  replicas: 1
  selector:
    matchLabels:
      app: hoarder-social-sharing
  template:
    metadata:
      labels:
        app: hoarder-social-sharing
    spec:
      containers:
      - image: hoarder-social-sharing
        name: hoarder-social-sharing
        env:
          - name: BLUESKY_USERNAME
            valueFrom:
              secretKeyRef:
                key: BLUESKY_USERNAME
                name: hoarder-social-sharing-secret
          - name: BLUESKY_PASSWORD
            valueFrom:
              secretKeyRef:
                key: BLUESKY_PASSWORD
                name: hoarder-social-sharing-secret
          - name: LINKEDIN_ACCESS_TOKEN
            valueFrom:
              secretKeyRef:
                key: LINKEDIN_ACCESS_TOKEN
                name: hoarder-social-sharing-secret
          - name: LINKEDIN_USER_URN
            valueFrom:
              secretKeyRef:
                key: LINKEDIN_USER_URN
                name: hoarder-social-sharing-secret
```

You'll need to create a Kubernetes Secret named `hoarder-social-sharing-secret` with your social media credentials before deploying.

### Create the Secret

```bash
kubectl create secret generic hoarder-social-sharing-secret \
  --from-literal=BLUESKY_USERNAME='your-bluesky-username' \
  --from-literal=BLUESKY_PASSWORD='your-bluesky-password' \
  --from-literal=LINKEDIN_ACCESS_TOKEN='your-linkedin-token' \
  --from-literal=LINKEDIN_USER_URN='your-linkedin-urn'
```

### Deploy to Kubernetes

```bash
kubectl apply -f ./manifests/deployment.yaml
```

## 📋 How It Works

1. The webhook server receives notification when a bookmark is created, crawled, or AI-tagged in Hoarder
2. For new bookmarks, the service tracks them but doesn't post immediately
3. After crawling, if there's no summary, it requests AI summarization
4. Once a bookmark is fully processed (has tags and summary), it creates and posts to configured social media platforms
5. Posts are formatted specifically for each platform, with clean text and proper link/hashtag handling

## 🔧 Configuration

The application uses environment variables for all configuration settings. No values are hardcoded in the source code.

### Social Media Formatting

The application includes an array of engaging phrases that are randomly selected for each post. You can modify this array in the `ENGAGING_PHRASES` constant to customize the tone and style of your posts.

## 🔑 LinkedIn API Setup

Setting up the LinkedIn API for this application requires several steps:

### 1. Create a LinkedIn App

1. Log in to your LinkedIn account
2. Go to [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps/new)
3. You'll need a company page - [create one](https://www.linkedin.com/company/setup/new) if you don't have one
4. Fill out the details to create your app
5. Go to the "Settings" tab and verify your app

### 2. Enable Required Products

In the "Products" tab, enable:
- Share on LinkedIn
- Sign In with LinkedIn using OpenID Connect

### 3. Configure OAuth Scopes

In the "Auth" tab, ensure the following scopes are enabled:
- openid
- profile
- w_member_social
- email

### 4. Generate an Access Token

1. Go to [LinkedIn Token Generator](https://www.linkedin.com/developers/tools/oauth/token-generator)
2. Select your app from the dropdown
3. Check all the available scopes
4. Click "Request access token"
5. After login, you'll receive an access token (valid for 2 months)

### 5. Get Your LinkedIn URN

```bash
curl --silent -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  "https://api.linkedin.com/v2/userinfo"
```

The response will include a `sub` field - this is your LinkedIn URN.

### 6. Configure the Application

Set the environment variables:
- `LINKEDIN_ACCESS_TOKEN` - Your generated access token
- `LINKEDIN_USER_URN` - Your LinkedIn URN (the `sub` value)

Note: LinkedIn access tokens expire after 2 months, so you'll need to update them periodically.

## 📝 Post Formatting

### Bluesky Posts

- Character limit: 300 characters
- Includes title (when available), URL, summary, and hashtags
- Properly formats links and hashtags using Bluesky's facets system
- Optimized for maximum visibility

### LinkedIn Posts

- Includes full summary and up to 10 hashtags
- Uses emoji and formatting for visual appeal
- Properly attributes content with quotation marks around titles

## 🔄 Webhook Integration

Set up your Hoarder webhook to point to this service:

```
https://your-webhook-server.com/
# In the case of the kubernetes deployment if Hoarder is also in kubernetes
http://hoarder-social-sharing.hoarder.svc.cluster.local:3000 
```

The webhook will process the following operations:
- `created`: When a new bookmark is created
- `crawled`: After a bookmark's content has been crawled
- `ai tagged`: When AI tagging is complete

## 📄 License

This project is licensed under the WTFPL License - see the LICENSE file for details.

## ⭐ Acknowledgements

- Built with [Deno](https://deno.land/)
- Integrates with [Hoarder](https://hoarder.app/) for bookmark management
- Connects to Bluesky and LinkedIn social platforms
