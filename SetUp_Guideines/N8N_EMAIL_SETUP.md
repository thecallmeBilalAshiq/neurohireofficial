# n8n Email Setup Guide for NeuroHire

This guide explains how to set up n8n to send interview/test invitation emails for the NeuroHire application.

## Table of Contents
1. [Installing n8n](#installing-n8n)
2. [Starting n8n](#starting-n8n)
3. [Creating the Email Workflow](#creating-the-email-workflow)
4. [Configuring Environment Variables](#configuring-environment-variables)
5. [Testing the Setup](#testing-the-setup)
6. [Troubleshooting](#troubleshooting)

---

## Installing n8n

### Option 1: Using npm (Recommended for Development)

```bash
# Install n8n globally
npm install n8n -g

# Or using npx (no installation needed)
npx n8n
```

### Option 2: Using Docker

```bash
# Pull and run n8n with Docker
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```

### Option 3: Using Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: '3.8'
services:
  n8n:
    image: n8nio/n8n
    container_name: n8n
    restart: always
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=password
      - GENERIC_TIMEZONE=Asia/Karachi
    volumes:
      - n8n_data:/home/node/.n8n

volumes:
  n8n_data:
```

Run with:
```bash
docker-compose up -d
```

---

## Starting n8n

After installation, start n8n:

```bash
# Using npm global installation
n8n start

# Or using npx
npx n8n

# Or with a custom port
n8n start --port 5678
```

Access n8n at: **http://localhost:5678**

---

## Creating the Email Workflow

### Step 1: Create a New Workflow

1. Open n8n in your browser (http://localhost:5678)
2. Click **"Add workflow"** or the **"+"** button
3. Name it: `NeuroHire - Send Interview Emails`

### Step 2: Add Webhook Node (Trigger)

1. Click **"+"** to add a node
2. Search for **"Webhook"** and select it
3. Configure the webhook:
   - **HTTP Method**: `POST`
   - **Path**: `send-interview-emails`
   - **Authentication**: None (or Basic Auth for production)
   - **Response Mode**: `Last Node`

4. Copy the **Test URL** (looks like: `http://localhost:5678/webhook-test/send-interview-emails`)
5. Click **"Listen for Test Event"** to activate

### Step 3: Add Split In Batches Node

1. Add a new node after Webhook
2. Search for **"Split In Batches"**
3. Configure:
   - **Batch Size**: `1` (process one email at a time)
   - **Input Field Name**: `emails`

### Step 4: Add Email Node (Send Email)

You can use different email services. Here are the most common options:

#### Option A: Gmail (Recommended for Testing)

1. Add **"Gmail"** node
2. Create Gmail OAuth2 credentials:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable Gmail API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URI: `http://localhost:5678/rest/oauth2-credential/callback`
3. Configure the node:
   - **Resource**: `Message`
   - **Operation**: `Send`
   - **To**: `{{ $json.to }}`
   - **Subject**: `{{ $json.subject }}`
   - **Email Type**: `HTML` or `Text`
   - **Message**: `{{ $json.body }}`

#### Option B: SMTP (Generic Email)

1. Add **"Send Email"** node (SMTP)
2. Create SMTP credentials:
   - **Host**: Your SMTP server (e.g., `smtp.gmail.com`)
   - **Port**: `587` (TLS) or `465` (SSL)
   - **User**: Your email address
   - **Password**: Your app password (for Gmail, use App Password)
   - **SSL/TLS**: Enable as needed
3. Configure the node:
   - **From Email**: Your email address
   - **To Email**: `{{ $json.to }}`
   - **Subject**: `{{ $json.subject }}`
   - **Text**: `{{ $json.body }}`

#### Option C: SendGrid

1. Add **"SendGrid"** node
2. Create SendGrid API credentials at [sendgrid.com](https://sendgrid.com)
3. Configure:
   - **To Email**: `{{ $json.to }}`
   - **From Email**: Your verified sender email
   - **Subject**: `{{ $json.subject }}`
   - **Text**: `{{ $json.body }}`

### Step 5: Add Response Node

1. Add **"Respond to Webhook"** node at the end
2. Configure:
   - **Response Code**: `200`
   - **Response Body**: 
     ```json
     {
       "success": true,
       "message": "Emails sent successfully",
       "count": "{{ $('Split In Batches').item.json.emails.length }}"
     }
     ```

### Complete Workflow Structure

```
[Webhook] → [Split In Batches] → [Send Email] → [Respond to Webhook]
```

### Step 6: Activate the Workflow

1. Click the **"Active"** toggle in the top right
2. The workflow is now ready to receive requests

---

## Configuring Environment Variables

Add the n8n webhook URL to your backend `.env` file:

```env
# n8n Email Webhook Configuration
N8N_EMAIL_WEBHOOK_URL=http://localhost:5678/webhook/send-interview-emails
```

For production, use the production URL:
```env
N8N_EMAIL_WEBHOOK_URL=https://your-n8n-domain.com/webhook/send-interview-emails
```

---

## Testing the Setup

### Test Using curl

```bash
curl -X POST http://localhost:5678/webhook/send-interview-emails \
  -H "Content-Type: application/json" \
  -d '{
    "emails": [
      {
        "to": "test@example.com",
        "subject": "Test Interview Invitation",
        "body": "Dear Candidate,\n\nThis is a test email.\n\nBest regards,\nHR Team",
        "candidateName": "John Doe",
        "jobTitle": "Software Engineer",
        "company": "NeuroHire"
      }
    ],
    "totalCount": 1,
    "jobInfo": {
      "jobTitle": "Software Engineer",
      "company": "NeuroHire"
    },
    "sentAt": "2024-01-20T10:00:00.000Z"
  }'
```

### Test in n8n UI

1. Click **"Execute workflow"** button
2. Or send a test request from the NeuroHire application

---

## Workflow JSON Import

You can also import this pre-built workflow. Save this as `workflow.json` and import in n8n:

```json
{
  "name": "NeuroHire - Send Interview Emails",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "send-interview-emails",
        "responseMode": "lastNode",
        "options": {}
      },
      "id": "webhook-1",
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [250, 300]
    },
    {
      "parameters": {
        "batchSize": 1,
        "options": {}
      },
      "id": "split-1",
      "name": "Split In Batches",
      "type": "n8n-nodes-base.splitInBatches",
      "typeVersion": 2,
      "position": [450, 300]
    },
    {
      "parameters": {
        "fromEmail": "={{ $env.SMTP_FROM_EMAIL }}",
        "toEmail": "={{ $json.to }}",
        "subject": "={{ $json.subject }}",
        "text": "={{ $json.body }}"
      },
      "id": "email-1",
      "name": "Send Email",
      "type": "n8n-nodes-base.emailSend",
      "typeVersion": 2,
      "position": [650, 300],
      "credentials": {
        "smtp": {
          "id": "YOUR_SMTP_CREDENTIAL_ID",
          "name": "SMTP Account"
        }
      }
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ JSON.stringify({ success: true, message: 'Emails processed', count: $input.all().length }) }}"
      },
      "id": "respond-1",
      "name": "Respond to Webhook",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1,
      "position": [850, 300]
    }
  ],
  "connections": {
    "Webhook": {
      "main": [
        [
          {
            "node": "Split In Batches",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Split In Batches": {
      "main": [
        [
          {
            "node": "Send Email",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Send Email": {
      "main": [
        [
          {
            "node": "Respond to Webhook",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "active": false,
  "settings": {},
  "versionId": "1"
}
```

---

## Gmail App Password Setup

If using Gmail SMTP, you need to create an App Password:

1. Go to your [Google Account](https://myaccount.google.com/)
2. Navigate to **Security** → **2-Step Verification** (enable if not already)
3. Go to **App passwords**
4. Select **Mail** and **Windows Computer** (or Other)
5. Click **Generate**
6. Copy the 16-character password
7. Use this password in n8n SMTP credentials

Gmail SMTP settings:
- **Host**: `smtp.gmail.com`
- **Port**: `587`
- **Security**: `TLS`
- **Username**: Your Gmail address
- **Password**: The app password (not your regular password)

---

## Troubleshooting

### Error: Connection Refused

**Problem**: `ECONNREFUSED` when sending emails

**Solution**:
1. Ensure n8n is running on port 5678
2. Check the webhook URL in `.env` is correct
3. Make sure the workflow is **activated**

### Error: Webhook Not Found

**Problem**: 404 error when calling webhook

**Solution**:
1. Verify the webhook path matches (`send-interview-emails`)
2. Ensure the workflow is **active** (green toggle)
3. Check if using test URL vs production URL

### Error: Authentication Failed (Gmail)

**Problem**: Gmail authentication error

**Solution**:
1. Use App Password, not regular password
2. Enable 2-Step Verification first
3. Check "Less secure apps" is not needed with App Passwords

### Error: Rate Limiting

**Problem**: Too many emails sent

**Solution**:
1. Add delays between emails in n8n
2. Use a professional email service (SendGrid, Mailgun)
3. Increase batch size and add wait nodes

### Checking n8n Logs

```bash
# If running with npm
n8n start --tunnel

# If running with Docker
docker logs n8n
```

---

## Production Considerations

1. **Use a dedicated email service** (SendGrid, Mailgun, AWS SES) for production
2. **Enable authentication** on the webhook for security
3. **Set up error notifications** in n8n for failed emails
4. **Monitor delivery rates** and bounce rates
5. **Implement retry logic** for failed deliveries
6. **Use environment variables** for sensitive data

---

## API Request Format

The NeuroHire backend sends requests in this format:

```json
{
  "emails": [
    {
      "to": "candidate@email.com",
      "subject": "Interview Invitation - Software Engineer at NeuroHire",
      "body": "Dear John Doe,\n\nWe are pleased to invite you...",
      "candidateName": "John Doe",
      "jobTitle": "Software Engineer",
      "company": "NeuroHire"
    }
  ],
  "totalCount": 1,
  "jobInfo": {
    "jobTitle": "Software Engineer",
    "company": "NeuroHire"
  },
  "sentAt": "2024-01-20T10:00:00.000Z"
}
```

---

## Support

If you encounter issues:
1. Check n8n documentation: https://docs.n8n.io/
2. n8n Community Forum: https://community.n8n.io/
3. Check NeuroHire backend logs for error details
