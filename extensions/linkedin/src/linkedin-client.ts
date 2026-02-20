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
  personUrn: string;
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

  const body = {
    author: auth.personUrn,
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

  const body = {
    author: auth.personUrn,
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
 * Share an image on LinkedIn with text commentary.
 * Three-step process: register upload, upload binary, create post.
 */
export async function postImage(
  text: string,
  imagePath: string,
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

  // Step 1: Register upload
  const registerBody = {
    registerUploadRequest: {
      recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
      owner: auth.personUrn,
      serviceRelationships: [
        {
          relationshipType: "OWNER",
          identifier: "urn:li:userGeneratedContent",
        },
      ],
    },
  };

  const registerRes = await fetch(ASSETS_URL, {
    method: "POST",
    headers: linkedInHeaders(auth.token),
    body: JSON.stringify(registerBody),
  });

  if (!registerRes.ok) {
    const errBody = await registerRes.text();
    return { success: false, error: `Image register failed (${registerRes.status}): ${errBody}` };
  }

  const registerData = (await registerRes.json()) as {
    value: {
      uploadMechanism: {
        "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest": {
          uploadUrl: string;
        };
      };
      asset: string;
    };
  };

  const uploadUrl =
    registerData.value.uploadMechanism[
      "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
    ].uploadUrl;
  const assetUrn = registerData.value.asset;

  // Step 2: Upload the image binary
  const imageBuffer = await readFile(imagePath);
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.token}`,
      "Content-Type": "application/octet-stream",
    },
    body: imageBuffer,
  });

  if (!uploadRes.ok) {
    const errBody = await uploadRes.text();
    return { success: false, error: `Image upload failed (${uploadRes.status}): ${errBody}` };
  }

  // Step 3: Create the image share
  const imageMedia: Record<string, unknown> = {
    status: "READY",
    media: assetUrn,
  };
  if (title) imageMedia.title = { text: title };
  if (description) imageMedia.description = { text: description };

  const body = {
    author: auth.personUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: "IMAGE",
        media: [imageMedia],
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": visibility,
    },
  };

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
