# Supabase Storage Setup

This guide explains how to configure Supabase Storage for DevFlow avatar and logo uploads.

## Prerequisites

- A Supabase account (free tier is sufficient)
- Access to DevFlow API environment configuration

## Setup Steps

### 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign in with GitHub or email
4. Create a new project:
   - **Name:** devflow (or your preferred name)
   - **Database Password:** Generate a strong password
   - **Region:** Choose closest to your users
5. Wait for the project to be provisioned

### 2. Get API Credentials

1. In your Supabase dashboard, go to **Project Settings** > **API**
2. Copy the following values:
   - **Project URL** → `SUPABASE_URL`
   - **service_role key** (under "Project API keys") → `SUPABASE_SERVICE_KEY`

> **Security Note:** The `service_role` key has full access to your project. Never expose it in client-side code or commit it to version control.

### 3. Create Storage Bucket

1. Go to **Storage** in the left sidebar
2. Click **New bucket**
3. Configure the bucket:
   - **Name:** `devflow`
   - **Public:** Yes (for public URL access)
   - **File size limit:** 10MB (or higher if needed)
   - **Allowed MIME types:** `image/jpeg, image/png, image/webp, image/gif`
4. Click **Save**

### 4. Configure Bucket Policies (Optional)

For public read access with authenticated uploads, add these policies:

**Allow public read:**
```sql
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'devflow');
```

**Allow authenticated uploads:**
```sql
CREATE POLICY "Authenticated upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'devflow');
```

> **Note:** When using the `service_role` key, policies are bypassed. These policies are only needed if you plan to use the `anon` key for client-side uploads (not recommended for DevFlow).

### 5. Configure DevFlow Environment

Add the following variables to your `.env` file:

```bash
# Supabase Storage
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_BUCKET=devflow
```

### 6. Verify Configuration

Restart the DevFlow API and verify storage is configured:

```bash
# Check API logs for initialization message
docker-compose logs api | grep -i supabase

# Expected output:
# [UserSettingsService] Supabase Storage initialized
# [OrganizationsService] Supabase Storage initialized
```

## Usage

### Avatar Uploads

Users can upload avatars from `/settings/profile`:
- Supported formats: PNG, JPG, WebP, GIF
- Maximum size: 5MB
- Files stored at: `avatars/{userId}.{ext}`

### Logo Uploads

Organization admins can upload logos from `/settings/organization`:
- Supported formats: PNG, JPG, WebP, GIF
- Maximum size: 10MB
- Files stored at: `logos/{organizationId}.{ext}`

## File Structure

```
devflow/                     # Bucket
├── avatars/                 # User avatars
│   ├── user123.png
│   └── user456.jpg
└── logos/                   # Organization logos
    ├── org789.png
    └── org012.webp
```

## Public URLs

Uploaded files are accessible via public URLs:
```
https://{project-ref}.supabase.co/storage/v1/object/public/devflow/avatars/{userId}.png
```

## Troubleshooting

### "Avatar uploads not configured"

This error appears when Supabase environment variables are missing or invalid.

**Solution:**
1. Verify all three variables are set: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_BUCKET`
2. Check the URL format: `https://xxx.supabase.co` (no trailing slash)
3. Verify the service key is valid (should be a long JWT token)
4. Restart the API after changing environment variables

### "Upload failed: 400 Bad Request"

**Possible causes:**
- File exceeds size limit
- Invalid file type
- Bucket doesn't exist

**Solution:**
1. Check file size (max 5MB for avatars, 10MB for logos)
2. Verify file type is one of: PNG, JPG, WebP, GIF
3. Confirm bucket named `devflow` exists in Supabase Storage

### "Failed to delete avatar"

This warning appears when deleting a file that doesn't exist (e.g., external URL).

**Note:** This is expected behavior when:
- Avatar was set before Supabase was configured
- Avatar URL is from external service (Google, GitHub SSO)

## Security Considerations

1. **Never expose service_role key** - Only use on server-side
2. **Use HTTPS** - All Supabase URLs use HTTPS by default
3. **File validation** - DevFlow validates file type and size before upload
4. **URL validation** - Only Supabase URLs are deleted; external URLs are ignored

## Related Documentation

- [ENV_VARIABLES.md](../ENV_VARIABLES.md) - All environment variables
- [WEB_INTERFACE.md](../WEB_INTERFACE.md) - Settings UI documentation
- [Supabase Storage Docs](https://supabase.com/docs/guides/storage) - Official documentation
