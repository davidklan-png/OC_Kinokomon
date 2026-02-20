import { readFile } from "node:fs/promises";
import { getValidToken } from "./token-store.js";

const UGC_POSTS_URL = "https://api.linkedin.com/v2/ugcPosts";
const ASSETS_URL = "https://api.linkedin.com/v2/assets?action=registerUpload";

type Visibility = "PUBLIC" | "CONNECTIONS";

export interface PostResult {
  success: boolean;
  postId?: string;
  error?: string;
  warning?: string;
}

async function getAuth(): Promise<{
  token: string;
  personUrn?: string; // Made optional since we can't always fetch it
  warning?: string;
} | null> {
  return getValidToken();
}

function linkedInHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Restli-Protocol-Version": "2.0.0",
  };
}

/**
 * Post a text-only update to LinkedIn.
 */
export async function postText(
  text: string,
  visibility: Visibility = "PUBLIC",
): Promise<PostResult> {
  const auth = await getAuth();
  if (!auth) {
    return {
      success: false,
      error: "Not authenticated. Run `openclaw linkedin-auth` first.",
    };
  }

  // Build body - only include author field if we have a valid person URN
  // LinkedIn will infer the author from the authenticated token if omitted
  const body: Record<string, unknown> = {
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: "NONE",
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": visibility,
    },
  };

  // Only add author field if we have it and it's not a placeholder
  if (auth.personUrn && !auth.personUrn.startsWith('unknown')) {
    body.author = auth.personUrn;
  }

  const res = await fetch(UGC_POSTS_URL, {
    method: "POST",
    headers: linkedInHeaders(auth.token),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    return { success: false, error: `LinkedIn API error (${res.status}): ${errBody}` };
  }

  const postId = res.headers.get("X-RestLi-Id") ?? undefined;
  return { success: true, postId, warning: auth.warning };
}

/**
 * Share an article/URL on LinkedIn with optional commentary.
 */
export async function postArticle(
  text: string,
  url: string,
  title?: string,
  description?: string,
  visibility: Visibility = "PUBLIC",
): Promise<PostResult> {
  const auth = await getAuth();
  if (!auth) {
    return {
      success: false,
      error: "Not authenticated. Run `openclaw linkedin-auth` first.",
    };
  }

  const media: Record<string, unknown> = {
    status: "READY",
    originalUrl: url,
  };
  if (title) media.title = { text: title };
  if (description) media.description = { text: description };

  // Build body - only include author if we have it
  const body: Record<string, unknown> = {
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: "ARTICLE",
        media: [media],
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": visibility,
    },
  };

  if (auth.personUrn && !auth.personUrn.startsWith('unknown')) {
    body.author = auth.personUrn;
  }

  const res = await fetch(UGC_POSTS_URL, {
    method: "POST",
    headers: linkedInHeaders(auth.token),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    return { success: false, error: `LinkedIn API error (${res.status}): ${errBody}` };
  }

  const postId = res.headers.get("X-RestLi-Id") ?? undefined;
  return { success: true, postId, warning: auth.warning };
}

/**
 * Post an image with optional caption to LinkedIn.
 */
export async function postImage(
  text: string,
  imagePath: string,
  visibility: Visibility = "PUBLIC",
): Promise<PostResult> {
  const auth = await getAuth();
  if (!auth) {
    return {
      success: false,
      error: "Not authenticated. Run `openclaw linkedin-auth` first.",
    };
  }

  // Read image
  const imageBuffer = await readFile(imagePath);
  const imageBase64 = imageBuffer.toString("base64");

  // Build body
  const body: Record<string, unknown> = {
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: "IMAGE",
        media: [
          {
            "description": {
              "text": text,
            },
            "mediaType": "staticimage",
            "status": "READY",
          },
          {
            "description": {
              "altText": "image",
            },
            "mediaType": "staticimage:alttext",
            "binaryContent": imageBase64,
            "fileFormat": "JPEG",
            "dimensions": {
              "height": 1080,
              "width": 1920,
            },
            "status": "READY",
          },
        ],
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": visibility,
    },
  };

  // Only include author if we have it
  if (auth.personUrn && !auth.personUrn.startsWith('unknown')) {
    body.author = auth.personUrn;
  }

  // First, register the image upload
  const registerRes = await fetch(ASSETS_URL, {
    method: "POST",
    headers: linkedInHeaders(auth.token),
    body: JSON.stringify({ registerUploadRequest: { ...media, ...media[0] } }),
  });

  if (!registerRes.ok) {
    const errBody = await registerRes.text();
    return { success: false, error: `LinkedIn API error (${registerRes.status}): ${errBody}` };
  }

  const asset = await registerRes.json();

  // Second, create the UGC post
  const postRes = await fetch(UGC_POSTS_URL, {
    method: "POST",
    headers: linkedInHeaders(auth.token),
    body: JSON.stringify({
      ...body,
      specificContent: {
        ...body.specificContent,
        media: [asset.value],
      },
    }),
  });

  if (!postRes.ok) {
    const errBody = await postRes.text();
    return { success: false, error: `LinkedIn API error (${postRes.status}): ${errBody}` };
  }

  const postId = postRes.headers.get("X-RestLi-Id") ?? undefined;
  return { success: true, postId, warning: auth.warning };
}
