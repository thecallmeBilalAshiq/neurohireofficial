# n8n Configuration Guide for Facebook Image Upload

This guide explains how to configure n8n to receive job post data with images and upload them to Facebook.

## Overview

Your backend now sends job post data directly to n8n with image URLs (or base64 data URIs). The n8n workflow needs to:
1. Receive the webhook data
2. Download/process the image (if it's a URL or base64)
3. Upload the image to Facebook along with the job post text

---

## Step 1: Create n8n Workflow

### 1.1 Webhook Trigger Node

1. Add a **Webhook** node
2. Set the **HTTP Method** to `POST`
3. Set the **Path** to `/job-post` (or your preferred path)
4. Set **Response Mode** to `When Last Node Finishes`
5. **Save** the workflow and copy the webhook URL
6. Add this URL to your backend `.env` file as `N8N_WEBHOOK_URL`

**Example webhook URL:**
```
http://localhost:5678/webhook/job-post
```

Or if using ngrok:
```
https://your-ngrok-url.ngrok-free.app/webhook/job-post
```

---

## Step 2: Process Image Data

### 2.1 Add IF Node (Check Image Type)

Add an **IF** node after the Webhook to check if the image is base64 or a URL:

**Condition 1:**
- **Value 1:** `{{ $json.body.image.isBase64 }}`
- **Operation:** `equals`
- **Value 2:** `true`

**Output:** `true` = base64 image, `false` = URL image

---

### 2.2 Handle Base64 Images (TRUE branch)

If the image is base64, convert it to a file:

1. Add a **Code** node
2. Use this JavaScript code:

```javascript
// Extract base64 data
const base64Data = $input.item.json.body.image.url;
const base64String = base64Data.split(',')[1]; // Remove data:image/png;base64, prefix

// Convert base64 to buffer
const imageBuffer = Buffer.from(base64String, 'base64');

// Return as binary data
return {
  json: $input.item.json,
  binary: {
    data: {
      data: imageBuffer,
      mimeType: 'image/png', // or detect from base64Data
      fileName: 'job-post-image.png'
    }
  }
};
```

---

### 2.3 Handle URL Images (FALSE branch)

If the image is a URL, download it:

1. Add an **HTTP Request** node
2. Set **Method** to `GET`
3. Set **URL** to `{{ $json.body.image.url }}`
4. Set **Response Format** to `File`
5. Set **Output Property Name** to `imageFile`

---

## Step 3: Format Job Post Text

Add a **Code** node to format the job post message for Facebook:

```javascript
const jobPost = $input.item.json.body.jobPost;

// Format the job post message
const message = `
🎯 ${jobPost.jobTitle}

📍 Location: ${jobPost.location}
💼 Job Type: ${jobPost.jobType}
💰 Salary: ${jobPost.salary}
📚 Experience: ${jobPost.experience}
🎓 Education: ${jobPost.education}

📝 Description:
${jobPost.description}

${jobPost.skills ? `🔧 Skills: ${jobPost.skills}` : ''}

${jobPost.deadline ? `⏰ Deadline: ${jobPost.deadline}` : ''}

🔗 Apply Now: ${jobPost.applicationUrl}
`;

return {
  json: {
    message: message,
    jobPost: jobPost
  },
  binary: $input.item.binary // Pass through the image binary data
};
```

---

## Step 4: Upload to Facebook

### 4.1 Facebook Node Configuration

1. Add a **Facebook Pages** node (or **Facebook Graph API** node)
2. Connect your Facebook account in n8n credentials
3. Configure the node:

**For Facebook Pages API:**

**Method:** `Create Post with Photo`

**Parameters:**
- **Page ID:** Your Facebook Page ID
- **Message:** `{{ $json.message }}`
- **Image:** Select the binary data from previous node (e.g., `{{ $binary.data }}` or `{{ $binary.imageFile }}`)

**Alternative: Using Facebook Graph API Node**

If using the Graph API node directly:

**Method:** `POST`
**Resource:** `/{{pageId}}/photos`
**Parameters:**
- **message:** `{{ $json.message }}`
- **url:** (if using URL) or attach binary data

---

## Step 5: Complete Workflow Structure

```
Webhook (POST /job-post)
  ↓
IF Node (Check if image is base64)
  ├─ TRUE → Code Node (Convert base64 to binary)
  └─ FALSE → HTTP Request (Download image from URL)
  ↓
Code Node (Format job post message)
  ↓
Facebook Pages Node (Upload post with image)
  ↓
Respond to Webhook (Success response)
```

---

## Step 6: Handle Errors

Add an **Error Trigger** node to catch and log errors:

1. Add **Error Trigger** node
2. Connect it to a **Code** node to log errors
3. Return error response to webhook

---

## Important Notes

### Image Formats Supported:
- **Base64 Data URI:** `data:image/png;base64,iVBORw0KGgo...`
- **HTTP/HTTPS URLs:** `https://example.com/image.png`
- **Local Template URLs:** `https://your-ngrok-url.ngrok-free.app/Temaple-01.jpg`

### Environment Variables:

Make sure your backend `.env` has:
```env
N8N_WEBHOOK_URL=http://localhost:5678/webhook/job-post
# Or with ngrok:
N8N_WEBHOOK_URL=https://your-ngrok-url.ngrok-free.app/webhook/job-post

FRONTEND_URL=https://your-ngrok-url.ngrok-free.app
# Or:
FRONTEND_URL=http://localhost:3000
```

### Testing:

1. Test the webhook with a sample payload:
```json
{
  "jobPost": {
    "jobTitle": "Frontend Developer",
    "company": "NeuroHire",
    "location": "Faisalabad, Pakistan",
    "jobType": "Full-time",
    "salary": "$200 - $300",
    "experience": "5 years",
    "education": "PhD in Computer Science",
    "description": "Job description here...",
    "applicationUrl": "https://your-app.com/jobs/123"
  },
  "image": {
    "url": "https://example.com/image.png",
    "isBase64": false
  },
  "platforms": ["facebook"]
}
```

2. Check n8n execution logs for errors
3. Verify the post appears on your Facebook page

---

## Troubleshooting

### Image not uploading:
- Check if the image URL is accessible (not localhost without ngrok)
- Verify binary data is correctly passed between nodes
- Check Facebook API permissions (you need `pages_manage_posts` permission)

### Base64 conversion failing:
- Ensure the base64 string doesn't include the `data:image/png;base64,` prefix in the buffer conversion
- Check the MIME type matches the actual image format

### Facebook API errors:
- Verify your Facebook Page access token has the correct permissions
- Check that the Page ID is correct
- Ensure the image file size is within Facebook's limits (usually max 4MB)

---

## Example Complete n8n Workflow JSON

You can import this workflow structure into n8n:

```json
{
  "name": "Job Post to Facebook",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "job-post",
        "responseMode": "lastNode"
      },
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "position": [250, 300]
    },
    {
      "parameters": {
        "conditions": {
          "boolean": [
            {
              "value1": "={{ $json.body.image.isBase64 }}",
              "operation": "equals",
              "value2": true
            }
          ]
        }
      },
      "name": "Check Image Type",
      "type": "n8n-nodes-base.if",
      "position": [450, 300]
    },
    {
      "parameters": {
        "jsCode": "// Base64 to binary conversion code here"
      },
      "name": "Convert Base64",
      "type": "n8n-nodes-base.code",
      "position": [650, 200]
    },
    {
      "parameters": {
        "method": "GET",
        "url": "={{ $json.body.image.url }}",
        "options": {
          "response": {
            "response": {
              "responseFormat": "file"
            }
          }
        }
      },
      "name": "Download Image",
      "type": "n8n-nodes-base.httpRequest",
      "position": [650, 400]
    },
    {
      "parameters": {
        "jsCode": "// Format message code here"
      },
      "name": "Format Message",
      "type": "n8n-nodes-base.code",
      "position": [850, 300]
    },
    {
      "parameters": {
        "resource": "photo",
        "operation": "create",
        "pageId": "={{ $env.FACEBOOK_PAGE_ID }}",
        "message": "={{ $json.message }}",
        "binaryPropertyName": "data"
      },
      "name": "Post to Facebook",
      "type": "n8n-nodes-base.facebookPages",
      "position": [1050, 300]
    }
  ],
  "connections": {
    "Webhook": {
      "main": [[{"node": "Check Image Type"}]]
    },
    "Check Image Type": {
      "main": [
        [{"node": "Convert Base64"}],
        [{"node": "Download Image"}]
      ]
    },
    "Convert Base64": {
      "main": [[{"node": "Format Message"}]]
    },
    "Download Image": {
      "main": [[{"node": "Format Message"}]]
    },
    "Format Message": {
      "main": [[{"node": "Post to Facebook"}]]
    }
  }
}
```

---

## Next Steps

1. Set up your n8n workflow using the steps above
2. Test with a sample job post
3. Verify the image uploads correctly to Facebook
4. Monitor the workflow executions for any errors
5. Adjust the message formatting as needed for your brand

For more help, refer to:
- [n8n Documentation](https://docs.n8n.io/)
- [Facebook Graph API Documentation](https://developers.facebook.com/docs/graph-api)
- [Facebook Pages API](https://developers.facebook.com/docs/pages)

